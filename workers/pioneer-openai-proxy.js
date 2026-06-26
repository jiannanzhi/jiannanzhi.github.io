const DEFAULT_UPSTREAM_BASE = 'https://api.pioneer.ai';

const buildCorsHeaders = (requestOrigin = '*', env = {}) => {
  const allowedOrigin = env.ALLOWED_ORIGIN?.trim() || requestOrigin || '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
    'Access-Control-Expose-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
};

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

const copyResponseHeaders = (sourceHeaders, corsHeaders) => {
  const headers = new Headers(sourceHeaders);
  headers.delete('content-length');
  headers.delete('content-encoding');
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return headers;
};

const buildUpstreamUrl = (requestUrl, upstreamBase) => {
  const url = new URL(requestUrl);
  if (url.pathname === '/' || url.pathname === '') return null;
  return new URL(url.pathname + url.search, upstreamBase).toString();
};

const buildUpstreamHeaders = (requestHeaders, env) => {
  const headers = new Headers(requestHeaders);
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');

  const secretApiKey = env.PIONEER_API_KEY?.trim();
  if (secretApiKey) {
    headers.set('Authorization', `Bearer ${secretApiKey}`);
  }

  return headers;
};

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get('Origin') || '*';
    const corsHeaders = buildCorsHeaders(requestOrigin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const upstreamBase = (env.UPSTREAM_BASE_URL || DEFAULT_UPSTREAM_BASE).replace(/\/+$/, '');
    const upstreamUrl = buildUpstreamUrl(request.url, upstreamBase);

    if (!upstreamUrl) {
      return json(
        {
          ok: true,
          name: 'pioneer-openai-proxy',
          usage: {
            endpoint: 'https://<your-worker>.workers.dev/v1',
            note: 'Point READING-main API endpoint here. The worker will forward /v1/models and /v1/chat/completions to Pioneer.',
          },
        },
        200,
        corsHeaders
      );
    }

    try {
      const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase());
      const upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers: buildUpstreamHeaders(request.headers, env),
        body: hasBody ? request.body : undefined,
        redirect: 'follow',
      });

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: copyResponseHeaders(upstreamResponse.headers, corsHeaders),
      });
    } catch (error) {
      return json(
        {
          error: 'proxy_request_failed',
          message: error instanceof Error ? error.message : String(error),
        },
        502,
        corsHeaders
      );
    }
  },
};
