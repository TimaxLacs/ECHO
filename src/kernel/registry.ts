import { EchoError, type ChannelAdapter, type LlmProvider, type MemoryProvider, type SlotKind, type SttProvider, type ToolHandler, type TtsProvider } from "./types.js";

export type AnyProvider = LlmProvider | SttProvider | TtsProvider | MemoryProvider;

export class Registry {
  readonly llm = new Map<string, LlmProvider>();
  readonly stt = new Map<string, SttProvider>();
  readonly tts = new Map<string, TtsProvider>();
  readonly memory = new Map<string, MemoryProvider>();
  readonly tools = new Map<string, ToolHandler>();
  readonly channels = new Map<string, ChannelAdapter>();

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

  registerTool(handler: ToolHandler): void {
    this.tools.set(handler.spec.name, handler);
  }

  registerChannel(channel: ChannelAdapter): void {
    this.channels.set(channel.id, channel);
  }

  require(kind: SlotKind, id: string): AnyProvider | ChannelAdapter | ToolHandler {
    const found = this.mapFor(kind).get(id);
    if (!found) throw new EchoError("slot_missing", `Слот ${kind}/${id} не зарегистрирован`);
    return found as AnyProvider | ChannelAdapter | ToolHandler;
  }

  mapFor(kind: SlotKind): Map<string, unknown> {
    switch (kind) {
      case "llm":
        return this.llm;
      case "stt":
        return this.stt;
      case "tts":
        return this.tts;
      case "memory":
        return this.memory;
      case "tool":
        return this.tools;
      case "channel":
        return this.channels;
    }
  }
}
