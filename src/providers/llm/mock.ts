import type { LlmInput, LlmOutput, LlmProvider, ToolCall } from "../../kernel/types.js";

export class MockLlm implements LlmProvider {
  readonly kind = "llm" as const;

  constructor(
    readonly id = "mock-llm",
    private readonly script: (input: LlmInput) => LlmOutput = defaultScript,
  ) {}

  async probe(): Promise<boolean> {
    return true;
  }

  async complete(input: LlmInput): Promise<LlmOutput> {
    return this.script(input);
  }
}

function defaultScript(input: LlmInput): LlmOutput {
  const last = input.messages.at(-1);
  if (last?.role === "tool") {
    return { text: last.content || "Готово.", toolCalls: [] };
  }
  const lastUser = [...input.messages].reverse().find((message) => message.role === "user");
  const text = lastUser?.content ?? "";
  const names = new Set(input.tools.map((tool) => tool.name));
  const call = matchTool(text, names);
  if (call) return { text: "", toolCalls: [call] };
  return { text: `Эхо (mock): ${text || "слушаю"}`, toolCalls: [] };
}

function matchTool(text: string, names: Set<string>): ToolCall | null {
  const lower = text.toLowerCase();
  if (names.has("now") && /(час|время|date|time)/i.test(lower)) {
    return { id: "mock_now", name: "now", arguments: {} };
  }
  if (names.has("memory") && /(запомн|remember|помни)/i.test(lower)) {
    return { id: "mock_mem", name: "memory", arguments: { action: "remember", note: text } };
  }
  return null;
}
