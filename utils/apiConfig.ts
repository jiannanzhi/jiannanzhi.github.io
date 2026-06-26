import { ApiConfig, ApiExcludedParameter } from '../types';

export const API_EXCLUDED_PARAMETER_OPTIONS: Array<{ value: ApiExcludedParameter; label: string }> = [
  { value: 'presence_penalty', label: 'presence_penalty' },
  { value: 'frequency_penalty', label: 'frequency_penalty' },
  { value: 'top_p', label: 'top_p' },
  { value: 'top_k', label: 'top_k' },
  { value: 'temperature', label: 'temperature' },
];

const API_EXCLUDED_PARAMETER_SET = new Set<ApiExcludedParameter>(
  API_EXCLUDED_PARAMETER_OPTIONS.map((item) => item.value)
);

export const DEFAULT_EXCLUDED_PARAMETERS: ApiExcludedParameter[] = [];

export const normalizeExcludedParameters = (value: unknown): ApiExcludedParameter[] => {
  if (!Array.isArray(value)) return [...DEFAULT_EXCLUDED_PARAMETERS];
  const next = value.filter(
    (item): item is ApiExcludedParameter =>
      typeof item === 'string' && API_EXCLUDED_PARAMETER_SET.has(item as ApiExcludedParameter)
  );
  return Array.from(new Set(next));
};

export const normalizeApiConfig = (value: unknown, fallback: ApiConfig): ApiConfig => {
  if (!value || typeof value !== 'object') {
    return {
      ...fallback,
      excludedParameters: normalizeExcludedParameters(fallback.excludedParameters),
    };
  }
  const raw = value as Partial<ApiConfig>;
  return {
    provider: raw.provider ?? fallback.provider,
    endpoint: typeof raw.endpoint === 'string' ? raw.endpoint : fallback.endpoint,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : fallback.apiKey,
    model: typeof raw.model === 'string' ? raw.model : fallback.model,
    excludedParameters: normalizeExcludedParameters(raw.excludedParameters),
  };
};

export const normalizeApiPresetList = <T extends { config: ApiConfig }>(
  value: unknown,
  fallbackConfig: ApiConfig
): T[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is T => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      ...item,
      config: normalizeApiConfig(item.config, fallbackConfig),
    }));
};

export const areExcludedParametersEqual = (
  left: ApiConfig['excludedParameters'],
  right: ApiConfig['excludedParameters']
) => {
  const normalizedLeft = normalizeExcludedParameters(left);
  const normalizedRight = normalizeExcludedParameters(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((item, index) => item === normalizedRight[index]);
};

export const applyExcludedParametersToPayload = <
  T extends Record<string, unknown>,
>(
  payload: T,
  config: Pick<ApiConfig, 'excludedParameters'>
): Partial<T> => {
  const excluded = new Set(normalizeExcludedParameters(config.excludedParameters));
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !excluded.has(key as ApiExcludedParameter))
  ) as Partial<T>;
};
