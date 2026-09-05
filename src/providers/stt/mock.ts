import type { SttProvider } from "../../kernel/types.js";

export class MockStt implements SttProvider {
  readonly kind = "stt" as const;

  constructor(
    readonly id = "mock-stt",
    private readonly transcript = "привет",
  ) {}

  async probe(): Promise<boolean> {
    return true;
  }

  async transcribe(audio: Buffer): Promise<string> {
    if (audio.length === 0) return "";
    return this.transcript;
  }
}
