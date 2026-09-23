export type Role = "system" | "user" | "assistant" | "tool";

export type Risk = "read" | "write" | "exec";

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatMessage = {
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
};

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  risk: Risk;
};

export type ToolResult = {
  ok: boolean;
  content: string;
};

export type Turn = {
  channel: string;
  speaker?: string;
  text?: string;
  audio?: Buffer;
  provider?: string;
};

export type ToolTrace = {
  name: string;
  ok: boolean;
  content: string;
};

export type ChainAttempt = {
  id: string;
  ok: boolean;
  detail: string;
};

export type Reply = {
  text: string;
  audio?: Buffer;
  toolTrace: ToolTrace[];
  provider: { llm: string; model?: string; tts?: string; stt?: string };
  attempts: ChainAttempt[];
};

export type VoiceRef = {
  id: string;
  path?: string;
};

export type LlmInput = {
  messages: ChatMessage[];
  tools: ToolSpec[];
};

export type LlmOutput = {
  text: string;
  toolCalls: ToolCall[];
};

export interface LlmProvider {
  readonly id: string;
  readonly kind: "llm";
  readonly model: string;
  complete(input: LlmInput): Promise<LlmOutput>;
  probe(): Promise<boolean>;
  describe(): string;
}

export interface SttProvider {
  readonly id: string;
  readonly kind: "stt";
  transcribe(audio: Buffer, language?: string): Promise<string>;
  probe(): Promise<boolean>;
}

export interface TtsProvider {
  readonly id: string;
  readonly kind: "tts";
  synthesize(text: string, voice?: VoiceRef): Promise<Buffer>;
  probe(): Promise<boolean>;
}

export interface MemoryProvider {
  readonly id: string;
  readonly kind: "memory";
  recall(query: string, speaker?: string): Promise<string>;
  remember(note: string, speaker?: string): Promise<void>;
  core(speaker?: string): Promise<string>;
  journal(user: string, reply: string): Promise<void>;
  probe(): Promise<boolean>;
}

export type ToolContext = {
  speaker?: string;
  memory: MemoryProvider;
  home: string;
};

export interface ToolHandler {
  spec: ToolSpec;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export type SlotHealth = {
  id: string;
  kind: "llm" | "stt" | "tts" | "memory";
  ok: boolean;
  detail: string;
};

export class EchoError extends Error {
  readonly code: string;
  readonly attempts?: ChainAttempt[];

  constructor(code: string, message: string, attempts?: ChainAttempt[]) {
    super(message);
    this.code = code;
    this.name = "EchoError";
    this.attempts = attempts;
  }
}
