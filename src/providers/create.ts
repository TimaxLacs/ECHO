import type { EchoConfig, ProviderConfig } from "../config/schema.js";
import type { Registry } from "../kernel/registry.js";
import { FileMemory } from "./memory/files.js";
import { MockLlm } from "./llm/mock.js";
import { OpenAiCompatLlm } from "./llm/openai-compat.js";
import { OpenAiCompatStt } from "./stt/openai-compat.js";
import { OpenAiCompatTts } from "./tts/openai-compat.js";
import { ZonosTts } from "./tts/zonos.js";

export function registerBuiltinProviders(
  registry: Registry,
  config: EchoConfig,
  home: string,
  secrets: readonly string[],
): void {
  for (const [id, provider] of Object.entries(config.providers)) {
    registerProvider(registry, id, provider, home, secrets);
  }
}

function registerProvider(
  registry: Registry,
  id: string,
  config: ProviderConfig,
  home: string,
  secrets: readonly string[],
): void {
  if (config.kind === "llm") {
    registry.registerLlm(
      config.preset === "mock" ? new MockLlm(id) : new OpenAiCompatLlm(id, config, fetch, secrets),
    );
    return;
  }
  if (config.kind === "stt") {
    registry.registerStt(new OpenAiCompatStt(id, config, secrets));
    return;
  }
  if (config.kind === "tts") {
    registry.registerTts(
      config.preset === "zonos" ? new ZonosTts(id, config) : new OpenAiCompatTts(id, config, secrets),
    );
    return;
  }
  registry.registerMemory(new FileMemory(id, home, secrets));
}
