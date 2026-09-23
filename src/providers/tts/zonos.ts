import type { ProviderConfig } from "../../config/schema.js";
import type { TtsProvider, VoiceRef } from "../../kernel/types.js";
import { EchoError } from "../../kernel/types.js";

export class ZonosTts implements TtsProvider {
  readonly kind = "tts" as const;

  constructor(
    readonly id: string,
    private readonly config: ProviderConfig,
  ) {}

  async probe(): Promise<boolean> {
    const baseUrl = (this.config.baseUrl ?? "http://127.0.0.1:5050").replace(/\/+$/, "");
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1500) }).catch(() => null);
    return Boolean(response);
  }

  async synthesize(text: string, voice?: VoiceRef): Promise<Buffer> {
    const baseUrl = (this.config.baseUrl ?? "http://127.0.0.1:5050").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 20_000),
      body: JSON.stringify({
        text,
        language: this.config.language ?? "ru",
        speaker: voice?.path ?? this.config.voicePath,
      }),
    });
    if (!response.ok) {
      throw new EchoError("tts_http", `${this.id}: Zonos ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
