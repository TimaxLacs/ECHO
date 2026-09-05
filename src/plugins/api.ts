import type { ChannelAdapter, LlmProvider, MemoryProvider, SttProvider, ToolHandler, TtsProvider } from "../kernel/types.js";
import type { Registry } from "../kernel/registry.js";

export type EchoPluginApi = {
  registerLlm(provider: LlmProvider): void;
  registerStt(provider: SttProvider): void;
  registerTts(provider: TtsProvider): void;
  registerMemory(provider: MemoryProvider): void;
  registerTool(handler: ToolHandler): void;
  registerChannel(channel: ChannelAdapter): void;
};

export function pluginApi(registry: Registry): EchoPluginApi {
  return {
    registerLlm: (provider) => registry.registerLlm(provider),
    registerStt: (provider) => registry.registerStt(provider),
    registerTts: (provider) => registry.registerTts(provider),
    registerMemory: (provider) => registry.registerMemory(provider),
    registerTool: (handler) => registry.registerTool(handler),
    registerChannel: (channel) => registry.registerChannel(channel),
  };
}

export type EchoPlugin = (api: EchoPluginApi) => void | Promise<void>;
