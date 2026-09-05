import type { ProviderConfig } from "../../config/schema.js";
import { OpenAiCompatLlm } from "./openai-compat.js";

export class OllamaLlm extends OpenAiCompatLlm {
  constructor(id: string, config: ProviderConfig) {
    super(id, {
      ...config,
      baseUrl: config.baseUrl ?? "http://127.0.0.1:11434/v1",
      model: config.model ?? "qwen2.5:7b",
    });
  }
}
