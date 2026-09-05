import fs from "node:fs/promises";
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
    const baseUrl = this.config.baseUrl ?? "http://127.0.0.1:5050";
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    return Boolean(response);
  }

  async synthesize(text: string, voice?: VoiceRef): Promise<Buffer> {
    const baseUrl = (this.config.baseUrl ?? "http://127.0.0.1:5050").replace(/\/$/, "");
    const voicePath = voice?.path ?? this.config.voicePath;
    const response = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        language: this.config.language ?? "ru",
        speaker: voicePath,
      }),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());

    if (response.status !== 404) {
      throw new EchoError("tts_http", `${this.id}: ${response.status} ${await response.text()}`);
    }
    return this.generateViaNpm(text, voicePath);
  }

  private async generateViaNpm(text: string, voicePath?: string): Promise<Buffer> {
    try {
      const mod = (await import("zonosjs")) as { default?: ZonosClient; ZonosJS?: ZonosClient };
      const Client = mod.default ?? mod.ZonosJS;
      if (!Client) throw new Error("нет клиента");
      const client = typeof Client === "function" ? new (Client as new () => { generateSpeech: Generate })() : Client;
      const audio = await client.generateSpeech(text, voicePath, this.config.language ?? "ru");
      return Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
    } catch {
      if (voicePath) await fs.access(voicePath);
      throw new EchoError(
        "tts_zonos",
        `${this.id}: сервер Zonos не доступен, пакет zonosjs не установлен`,
      );
    }
  }
}

type Generate = (text: string, voice?: string, language?: string) => Promise<Buffer | Uint8Array>;
type ZonosClient = { generateSpeech: Generate } | (new () => { generateSpeech: Generate });
