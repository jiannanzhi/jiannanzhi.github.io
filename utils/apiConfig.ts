import { ApiConfig, ApiExcludedParameter, ApiSamplingParameter } from '../types';

interface ApiParameterControlOption {
  value: ApiSamplingParameter;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export const API_PARAMETER_CONTROL_OPTIONS: ApiParameterControlOption[] = [
  { value: 'temperature', label: 'temperature', min: 0, max: 2, step: 0.01, defaultValue: 0.85 },
  { value: 'top_p', label: 'top_p', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  { value: 'top_k', label: 'top_k', min: 0, max: 200, step: 1, defaultValue: 0 },
  { value: 'presence_penalty', label: 'presence_penalty', min: -2, max: 2, step: 0.01, defaultValue: 0 },
  { value: 'frequency_penalty', label: 'frequency_penalty', min: -2, max: 2, step: 0.01, defaultValue: 0 },
];

export const API_EXCLUDED_PARAMETER_OPTIONS: Array<{ value: ApiExcludedParameter; label: string }> =
  API_PARAMETER_CONTROL_OPTIONS.map((item) => ({ value: item.value, label: item.label }));

const API_PARAMETER_CONTROL_MAP = new Map<ApiSamplingParameter, ApiParameterControlOption>(
  API_PARAMETER_CONTROL_OPTIONS.map((item) => [item.value, item])
);

const API_EXCLUDED_PARAMETER_SET = new Set<ApiExcludedParameter>(
  API_EXCLUDED_PARAMETER_OPTIONS.map((item) => item.value)
);

export const DEFAULT_EXCLUDED_PARAMETERS: ApiExcludedParameter[] = [];

export const DEFAULT_API_PARAMETER_VALUES = API_PARAMETER_CONTROL_OPTIONS.reduce(
  (accumulator, item) => {
    accumulator[item.value] = item.defaultValue;
    return accumulator;
  },
  {} as Record<ApiSamplingParameter, number>
);

const getStepPrecision = (step: number) => {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const [, precision = ''] = `${step}`.split('.');
  return precision.length;
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeExcludedParameters = (value: unknown): ApiExcludedParameter[] => {
  if (!Array.isArray(value)) return [...DEFAULT_EXCLUDED_PARAMETERS];
  const next = value.filter(
    (item): item is ApiExcludedParameter =>
      typeof item === 'string' && API_EXCLUDED_PARAMETER_SET.has(item as ApiExcludedParameter)
  );
  return Array.from(new Set(next));
};

export const normalizeApiParameterValue = (
  key: ApiSamplingParameter,
  value: unknown,
  fallbackValue?: number
) => {
  const option = API_PARAMETER_CONTROL_MAP.get(key);
  if (!option) return 0;
  const rawFallback = Number.isFinite(Number(fallbackValue))
    ? Number(fallbackValue)
    : option.defaultValue;
  const rawValue = Number(value);
  const normalized = Number.isFinite(rawValue) ? rawValue : rawFallback;
  const clamped = clampNumber(normalized, option.min, option.max);
  const precision = getStepPrecision(option.step);
  if (option.step >= 1) return Math.round(clamped);
  return Number(clamped.toFixed(precision));
};

export const getApiParameterValue = (config: Partial<ApiConfig>, key: ApiSamplingParameter) =>
  normalizeApiParameterValue(key, config[key], DEFAULT_API_PARAMETER_VALUES[key]);

export const normalizeApiConfig = (value: unknown, fallback: ApiConfig): ApiConfig => {
  if (!value || typeof value !== 'object') {
    return {
      ...fallback,
      temperature: normalizeApiParameterValue('temperature', fallback.temperature),
      top_p: normalizeApiParameterValue('top_p', fallback.top_p),
      top_k: normalizeApiParameterValue('top_k', fallback.top_k),
      presence_penalty: normalizeApiParameterValue('presence_penalty', fallback.presence_penalty),
      frequency_penalty: normalizeApiParameterValue('frequency_penalty', fallback.frequency_penalty),
      excludedParameters: normalizeExcludedParameters(fallback.excludedParameters),
    };
  }
  const raw = value as Partial<ApiConfig>;
  return {
    provider: raw.provider ?? fallback.provider,
    endpoint: typeof raw.endpoint === 'string' ? raw.endpoint : fallback.endpoint,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : fallback.apiKey,
    model: typeof raw.model === 'string' ? raw.model : fallback.model,
    temperature: normalizeApiParameterValue('temperature', raw.temperature, fallback.temperature),
    top_p: normalizeApiParameterValue('top_p', raw.top_p, fallback.top_p),
    top_k: normalizeApiParameterValue('top_k', raw.top_k, fallback.top_k),
    presence_penalty: normalizeApiParameterValue('presence_penalty', raw.presence_penalty, fallback.presence_penalty),
    frequency_penalty: normalizeApiParameterValue('frequency_penalty', raw.frequency_penalty, fallback.frequency_penalty),
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

export const areApiParameterValuesEqual = (left: Partial<ApiConfig>, right: Partial<ApiConfig>) =>
  API_PARAMETER_CONTROL_OPTIONS.every(
    (item) => getApiParameterValue(left, item.value) === getApiParameterValue(right, item.value)
  );

export const summarizeApiParameterValues = (config: Partial<ApiConfig>) =>
  API_PARAMETER_CONTROL_OPTIONS.map((item) => `${item.label}=${getApiParameterValue(config, item.value)}`).join(' · ');

export const buildOpenAiCompatiblePayload = <
  T extends Record<string, unknown>,
>(
  payload: T,
  config: Pick<ApiConfig, ApiSamplingParameter | 'excludedParameters'>
): Partial<T> => {
  const topK = getApiParameterValue(config, 'top_k');
  const merged = {
    ...payload,
    temperature: getApiParameterValue(config, 'temperature'),
    top_p: getApiParameterValue(config, 'top_p'),
    presence_penalty: getApiParameterValue(config, 'presence_penalty'),
    frequency_penalty: getApiParameterValue(config, 'frequency_penalty'),
    ...(topK > 0 ? { top_k: topK } : {}),
  };
  const excluded = new Set(normalizeExcludedParameters(config.excludedParameters));
  return Object.fromEntries(
    Object.entries(merged).filter(([key]) => !excluded.has(key as ApiExcludedParameter))
  ) as Partial<T>;
};
