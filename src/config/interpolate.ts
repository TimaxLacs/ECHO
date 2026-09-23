const TOKEN = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

export function interpolate(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(TOKEN, (_match, name: string, fallback: string | undefined) => {
    const found = env[name];
    if (found !== undefined && found !== "") return found;
    return fallback ?? "";
  });
}

export function interpolateDeep<T>(value: T, env: NodeJS.ProcessEnv = process.env): T {
  if (typeof value === "string") return interpolate(value, env) as T;
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, env)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = interpolateDeep(item, env);
    return out as T;
  }
  return value;
}

export function mergeConfig(base: unknown, override: unknown): unknown {
  if (Array.isArray(override)) return override.slice();
  if (isPlain(base) && isPlain(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      out[key] = key in out ? mergeConfig(out[key], value) : value;
    }
    return out;
  }
  return override === undefined ? base : override;
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
