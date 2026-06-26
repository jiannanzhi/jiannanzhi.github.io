# Pioneer Cloudflare Worker Proxy

This worker is for browser-side CORS issues with Pioneer when `READING-main` runs on GitHub Pages.

## What it solves

`https://kencuo.github.io` cannot call `https://api.pioneer.ai/v1/models` or `/v1/chat/completions` directly if Pioneer does not return the needed CORS headers.

This worker sits in the middle:

`READING-main -> Cloudflare Worker -> Pioneer API`

## Deploy

### Option A: Cloudflare dashboard

1. Go to Cloudflare Workers.
2. Create a new Worker.
3. Replace the default code with [pioneer-openai-proxy.js](./pioneer-openai-proxy.js).
4. Save and deploy.

### Option B: Wrangler

Create a small worker project and use `workers/pioneer-openai-proxy.js` as the entry file.

## Recommended secrets / vars

### Secret

Add a Worker secret:

- `PIONEER_API_KEY`

If this secret exists, the worker will use it as:

`Authorization: Bearer <PIONEER_API_KEY>`

That means the front-end does not need to expose the real Pioneer key.

### Optional variable

- `ALLOWED_ORIGIN`

Recommended value:

`https://kencuo.github.io`

If unset, the worker will reflect the request origin.

### Optional variable

- `UPSTREAM_BASE_URL`

Default:

`https://api.pioneer.ai`

You usually do not need to change this.

## How to use in READING-main

After deployment, suppose your worker URL is:

`https://your-worker-name.workers.dev`

Then in `READING-main` API settings:

- `Provider`: `CUSTOM`
- `Endpoint`: `https://your-worker-name.workers.dev/v1`
- `API Key`:
  - If you set Worker secret `PIONEER_API_KEY`, you can fill any placeholder such as `cf-worker`
  - If you did not set Worker secret, fill your real Pioneer key here
- `Model`: manually type the Pioneer model ID, or try `拉取模型` again through the worker

## Important note

If Pioneer itself does not support `/v1/models`, then even through the worker the model list may still be empty.

That is okay.

You can still:

1. keep the Worker endpoint
2. manually type the model ID
3. use the normal chat flow
