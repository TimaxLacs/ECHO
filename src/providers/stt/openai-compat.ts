import type { ProviderConfig } from "../../config/schema.js";
import type { SttProvider } from "../../kernel/types.js";
import { EchoError } from "../../kernel/types.js";
import { redact } from "../../util/redact.js";

export class OpenAiCompatStt implements SttProvider {
  readonly kind = "stt" as const;

  constructor(
    readonly id: string,
    private readonly config: ProviderConfig,
    private readonly secrets: readonly string[] = [],
  ) {}

  probe(): Promise<boolean> {
    return Promise.resolve(Boolean(this.config.baseUrl?.trim()));
  }

  async transcribe(audio: Buffer, language?: string): Promise<string> {
    const baseUrl = this.config.baseUrl?.replace(/\/+$/, "");
    if (!baseUrl) throw new EchoError("stt_config", `${this.id}: пустой baseUrl`);
    const body = new FormData();
    body.set("file", new Blob([Uint8Array.from(audio)]), "speech.wav");
    body.set("model", this.config.model?.trim() || "whisper-1");
    body.set("language", language || this.config.language || "ru");
    const headers: Record<string, string> = {};
    if (this.config.apiKey?.trim()) headers.authorization = `Bearer ${this.config.apiKey.trim()}`;
    const response = await fetch(`${baseUrl}/audio/transcriptions`, { method: "POST", headers, body });
    const raw = await response.text();
    if (!response.ok) {
      throw new EchoError("stt_http", `${this.id}: ${response.status} ${redact(raw, this.secrets).slice(0, 300)}`);
    }
    const payload = JSON.parse(raw) as { text?: string };
    if (!payload.text?.trim()) throw new EchoError("stt_empty", `${this.id}: пустая транскрипция`);
    return payload.text.trim();
  }
}
