import fs from "node:fs/promises";
import path from "node:path";
import type { EchoConfig, ProviderConfig } from "./schema.js";
import { defaultConfig } from "./defaults.js";
import { mergeConfig } from "./interpolate.js";
import { loadConfig, type LoadedConfig } from "./load.js";
import { echoConfigSchema } from "./schema.js";

export type SettingsView = {
  identity: { name: string; language: string };
  chain: string[];
  local: { baseUrl: string; model: string };
  groq: { baseUrl: string; model: string; hasKey: boolean };
  openrouter: { baseUrl: string; model: string; hasKey: boolean };
};

export type ProviderPatch = {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  clearKey?: boolean;
};

export type SettingsPatch = {
  identity?: { name?: string; language?: string };
  chain?: string[];
  local?: { baseUrl?: string; model?: string };
  groq?: ProviderPatch;
  openrouter?: ProviderPatch;
};

export function viewSettings(config: EchoConfig): SettingsView {
  return {
    identity: { name: config.identity.name, language: config.identity.language },
    chain: [...config.slots.llm],
    local: endpointView(config.providers.local, "http://127.0.0.1:11434/v1"),
    groq: { ...endpointView(config.providers.groq, "https://api.groq.com/openai/v1"), hasKey: hasKey(config.providers.groq) },
    openrouter: {
      ...endpointView(config.providers.openrouter, "https://openrouter.ai/api/v1"),
      hasKey: hasKey(config.providers.openrouter),
    },
  };
}

export async function applySettings(loaded: LoadedConfig, patch: SettingsPatch): Promise<LoadedConfig> {
  let disk: unknown = {};
  try {
    disk = JSON.parse(await fs.readFile(loaded.path, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const next = echoConfigSchema.parse(mergeConfig(defaultConfig(), disk));
  if (patch.identity?.name?.trim()) next.identity.name = patch.identity.name.trim();
  if (patch.identity?.language?.trim()) next.identity.language = patch.identity.language.trim();
  if (patch.chain?.length) {
    const chain = patch.chain.map((id) => id.trim()).filter(Boolean);
    if (chain.length) next.slots.llm = chain;
  }
  assignEndpoint(providerOf(next, "local", "llm", "local"), patch.local, false);
  assignEndpoint(providerOf(next, "groq", "llm", "groq"), patch.groq, true);
  assignEndpoint(providerOf(next, "openrouter", "llm", "openrouter"), patch.openrouter, true);
  await fs.mkdir(path.dirname(loaded.path), { recursive: true, mode: 0o700 });
  await fs.writeFile(loaded.path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return loadConfig(loaded.home);
}

function providerOf(config: EchoConfig, id: string, kind: ProviderConfig["kind"], preset: string): ProviderConfig {
  const existing = config.providers[id];
  if (existing) return existing;
  const created: ProviderConfig = { kind, preset };
  config.providers[id] = created;
  return created;
}

function assignEndpoint(provider: ProviderConfig, patch: ProviderPatch | undefined, withKey: boolean): void {
  if (!patch) return;
  if (patch.baseUrl !== undefined && patch.baseUrl.trim()) provider.baseUrl = patch.baseUrl.trim();
  if (patch.model !== undefined && patch.model.trim()) provider.model = patch.model.trim();
  if (!withKey) {
    provider.apiKey = undefined;
    return;
  }
  if (patch.clearKey) provider.apiKey = "";
  else if (patch.apiKey?.trim()) provider.apiKey = patch.apiKey.trim();
}

function endpointView(provider: ProviderConfig | undefined, fallbackUrl: string): { baseUrl: string; model: string } {
  return {
    baseUrl: provider?.baseUrl?.trim() || fallbackUrl,
    model: provider?.model?.trim() || "",
  };
}

function hasKey(provider: ProviderConfig | undefined): boolean {
  return Boolean(provider?.apiKey?.trim());
}
