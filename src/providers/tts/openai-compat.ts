import type { ProviderConfig } from "../../config/schema.js";
import type { TtsProvider, VoiceRef } from "../../kernel/types.js";
import { EchoError } from "../../kernel/types.js";
import { redact } from "../../util/redact.js";

export class OpenAiCompatTts implements TtsProvider {
  readonly kind = "tts" as const;

  constructor(
    readonly id: string,
    private readonly config: ProviderConfig,
    private readonly secrets: readonly string[] = [],
  ) {}

  async probe(): Promise<boolean> {
    const baseUrl = this.config.baseUrl?.replace(/\/+$/, "");
    if (!baseUrl) return false;
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    return Boolean(response);
  }

  async synthesize(text: string, voice?: VoiceRef): Promise<Buffer> {
    const baseUrl = this.config.baseUrl?.replace(/\/+$/, "");
    if (!baseUrl) throw new EchoError("tts_config", `${this.id}: пустой baseUrl`);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey?.trim()) headers.authorization = `Bearer ${this.config.apiKey.trim()}`;
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
      body: JSON.stringify({
        model: this.config.model?.trim() || "tts-1",
        input: text,
        voice: voice?.id || "alloy",
      }),
    });
    if (!response.ok) {
      const raw = await response.text();
      throw new EchoError("tts_http", `${this.id}: ${response.status} ${redact(raw, this.secrets).slice(0, 300)}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
