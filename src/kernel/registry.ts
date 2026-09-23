import type { LlmProvider, MemoryProvider, SttProvider, ToolHandler, TtsProvider } from "./types.js";

export class Registry {
  readonly llm = new Map<string, LlmProvider>();
  readonly stt = new Map<string, SttProvider>();
  readonly tts = new Map<string, TtsProvider>();
  readonly memory = new Map<string, MemoryProvider>();
  readonly tools = new Map<string, ToolHandler>();

  registerLlm(provider: LlmProvider): void {
    this.llm.set(provider.id, provider);
  }

  registerStt(provider: SttProvider): void {
    this.stt.set(provider.id, provider);
  }

  registerTts(provider: TtsProvider): void {
    this.tts.set(provider.id, provider);
  }

  registerMemory(provider: MemoryProvider): void {
    this.memory.set(provider.id, provider);
  }

  registerTool(tool: ToolHandler): void {
    this.tools.set(tool.spec.name, tool);
  }
}
