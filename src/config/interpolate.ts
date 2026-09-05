const ENV_TOKEN = /\$\{([A-Z0-9_]+)\}/g;

export function interpolateEnv(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(ENV_TOKEN, (_match, name: string) => env[name] ?? "");
}

export function interpolateDeep<T>(value: T, env: NodeJS.ProcessEnv = process.env): T {
  if (typeof value === "string") return interpolateEnv(value, env) as T;
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, env)) as T;
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      next[key] = interpolateDeep(nested, env);
    }
    return next as T;
  }
  return value;
}

export function missingEnvTokens(value: string): string[] {
  return [...value.matchAll(ENV_TOKEN)].map((match) => match[1]);
}
