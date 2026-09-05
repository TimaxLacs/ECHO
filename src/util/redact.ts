const SECRET = /(api[_-]?key|token|password|secret|authorization|bearer)\s*[:=]\s*\S+/gi;

export function redact(text: string): string {
  return text.replace(SECRET, (match) => {
    const sep = match.includes("=") ? "=" : ":";
    const [label] = match.split(sep);
    return `${label}${sep} ***`;
  });
}

export function looksSecret(text: string): boolean {
  return SECRET.test(text);
}
