import type { EchoConfig, ProviderConfig } from "../config/schema.js";
import type { Registry } from "../kernel/registry.js";
import { FileMemory } from "./memory/files.js";
import { MockLlm } from "./llm/mock.js";
import { OllamaLlm } from "./llm/ollama.js";
import { OpenAiCompatLlm } from "./llm/openai-compat.js";
import { MockStt } from "./stt/mock.js";
import { OpenAiCompatStt } from "./stt/openai-compat.js";
import { MockTts } from "./tts/mock.js";
import { OpenAiCompatTts } from "./tts/openai-compat.js";
import { ZonosTts } from "./tts/zonos.js";

export function registerBuiltinProviders(registry: Registry, config: EchoConfig, home: string): void {
  for (const [id, provider] of Object.entries(config.providers)) {
    registerProvider(registry, id, provider, home);
  }
}

function registerProvider(registry: Registry, id: string, config: ProviderConfig, home: string): void {
  if (config.kind === "llm") {
    registry.registerLlm(createLlm(id, config));
    return;
  }
  if (config.kind === "stt") {
    registry.registerStt(id.includes("mock") ? new MockStt(id) : new OpenAiCompatStt(id, config));
    return;
  }
  if (config.kind === "tts") {
    registry.registerTts(createTts(id, config));
    return;
  }
  registry.registerMemory(new FileMemory(id, home));
}

function createLlm(id: string, config: ProviderConfig) {
  if (id.includes("mock")) return new MockLlm(id);
  if (id.includes("ollama")) return new OllamaLlm(id, config);
  return new OpenAiCompatLlm(id, config);
}

function createTts(id: string, config: ProviderConfig) {
  if (id.includes("mock")) return new MockTts(id);
  if (id.includes("zonos")) return new ZonosTts(id, config);
  return new OpenAiCompatTts(id, config);
}
