const SECRET_PATTERNS = [
  /gsk_[A-Za-z0-9_-]+/g,
  /sk-or-v1-[A-Za-z0-9]+/g,
  /sk-[A-Za-z0-9]{16,}/g,
  /Bearer\s+\S+/gi,
  /(api[_-]?key|token|password|secret|authorization)\s*[:=]\s*\S+/gi,
  /"user_id"\s*:\s*"[^"]+"/g,
];

export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text;
  const unique = [...new Set(secrets.map((item) => item.trim()).filter((item) => item.length >= 8))];
  unique.sort((a, b) => b.length - a.length);
  for (const secret of unique) out = out.split(secret).join("[secret]");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "[secret]");
  }
  return out;
}

export function collectSecrets(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value && value.trim().length >= 8 && !value.includes("${")));
}
