import { EchoError } from "../kernel/types.js";

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EchoError("invalid_args", "Ожидался объект аргументов");
  }
  return value as Record<string, unknown>;
}

export function readString(args: Record<string, unknown>, key: string, fallback?: string): string {
  const value = args[key];
  if (typeof value === "string" && value.trim()) return value;
  if (fallback !== undefined) return fallback;
  throw new EchoError("invalid_args", `Нужно строковое поле ${key}`);
}

export function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  return asRecord(parsed);
}

export function safeJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? String(item) : item));
}
