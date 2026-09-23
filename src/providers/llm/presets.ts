import type { ProviderConfig } from "../../config/schema.js";

export type LlmPresetName = "local" | "groq" | "openrouter" | "openai";

export type ResolvedLlm = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
  headers: Record<string, string>;
  sendKey: boolean;
};

const PRESETS: Record<LlmPresetName, { baseUrl: string; model: string; sendKey: boolean }> = {
  local: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5:0.5b", sendKey: false },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-20b", sendKey: true },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-oss-20b",
    sendKey: true,
  },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", sendKey: true },
};

export function isLlmPreset(value: string | undefined): value is LlmPresetName {
  return value === "local" || value === "groq" || value === "openrouter" || value === "openai";
}

export function resolveLlmEndpoint(config: ProviderConfig): ResolvedLlm {
  const preset = isLlmPreset(config.preset) ? PRESETS[config.preset] : undefined;
  const sendKey = preset ? preset.sendKey : Boolean(config.apiKey?.trim());
  const baseUrl = trimSlash(config.baseUrl?.trim() || preset?.baseUrl || "");
  const model =
    config.model?.trim() ||
    envModel(config.preset) ||
    preset?.model ||
    "";
  const apiKey = sendKey ? resolveKey(config) : undefined;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "echo-agent/0.1",
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (config.preset === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/TimaxLacs/ECHO";
    headers["X-Title"] = "Echo";
  }
  return {
    baseUrl,
    model,
    apiKey,
    timeoutMs: config.timeoutMs ?? 60_000,
    headers,
    sendKey,
  };
}

function resolveKey(config: ProviderConfig): string | undefined {
  const fromConfig = config.apiKey?.trim();
  if (fromConfig) return fromConfig;
  if (config.preset === "groq") return clean(process.env.GROQ_API_KEY);
  if (config.preset === "openrouter") return clean(process.env.OPENROUTER_API_KEY);
  if (config.preset === "openai") return clean(process.env.OPENAI_API_KEY);
  return undefined;
}

function envModel(preset: string | undefined): string | undefined {
  if (preset === "groq") return clean(process.env.GROQ_MODEL);
  if (preset === "openrouter") return clean(process.env.OPENROUTER_MODEL);
  if (preset === "local") return clean(process.env.LOCAL_LLM_MODEL);
  return undefined;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function endpointHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl || "без адреса";
  }
}
