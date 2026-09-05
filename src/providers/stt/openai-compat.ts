import type { ProviderConfig } from "../../config/schema.js";
import type { SttProvider } from "../../kernel/types.js";
import { EchoError } from "../../kernel/types.js";

export class OpenAiCompatStt implements SttProvider {
  readonly kind = "stt" as const;

  constructor(
    readonly id: string,
    private readonly config: ProviderConfig,
  ) {}

  async probe(): Promise<boolean> {
    return Boolean(this.config.baseUrl && this.config.apiKey);
  }

  async transcribe(audio: Buffer, language?: string): Promise<string> {
    const baseUrl = this.config.baseUrl?.replace(/\/$/, "");
    if (!baseUrl) throw new EchoError("stt_config", `${this.id}: пустой baseUrl`);

    const body = new FormData();
    body.set("file", new Blob([Uint8Array.from(audio)]), "speech.wav");
    body.set("model", this.config.model ?? "whisper-1");
    body.set("language", language ?? this.config.language ?? "ru");

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : undefined,
      body,
    });
    if (!response.ok) {
      throw new EchoError("stt_http", `${this.id}: ${response.status} ${await response.text()}`);
    }
    const payload = (await response.json()) as { text?: string };
    if (!payload.text?.trim()) throw new EchoError("stt_empty", `${this.id}: пустая транскрипция`);
    return payload.text.trim();
  }
}
