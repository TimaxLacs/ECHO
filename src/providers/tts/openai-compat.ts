import type { ProviderConfig } from "../../config/schema.js";
import type { TtsProvider, VoiceRef } from "../../kernel/types.js";
import { EchoError } from "../../kernel/types.js";

export class OpenAiCompatTts implements TtsProvider {
  readonly kind = "tts" as const;

  constructor(
    readonly id: string,
    private readonly config: ProviderConfig,
  ) {}

  async probe(): Promise<boolean> {
    return Boolean(this.config.baseUrl && this.config.apiKey);
  }

  async synthesize(text: string, voice?: VoiceRef): Promise<Buffer> {
    const baseUrl = this.config.baseUrl?.replace(/\/$/, "");
    if (!baseUrl) throw new EchoError("tts_config", `${this.id}: пустой baseUrl`);

    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model ?? "tts-1",
        input: text,
        voice: voice?.id ?? "alloy",
      }),
    });
    if (!response.ok) {
      throw new EchoError("tts_http", `${this.id}: ${response.status} ${await response.text()}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
