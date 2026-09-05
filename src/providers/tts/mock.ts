import type { TtsProvider } from "../../kernel/types.js";

export class MockTts implements TtsProvider {
  readonly kind = "tts" as const;

  constructor(readonly id = "mock-tts") {}

  async probe(): Promise<boolean> {
    return true;
  }

  async synthesize(text: string): Promise<Buffer> {
    return Buffer.from(`ECHO-TTS\n${text}`, "utf8");
  }
}
