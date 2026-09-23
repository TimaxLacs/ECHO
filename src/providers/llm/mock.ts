import type { LlmInput, LlmOutput, LlmProvider } from "../../kernel/types.js";

export class MockLlm implements LlmProvider {
  readonly kind = "llm" as const;
  readonly model = "mock";

  constructor(readonly id: string) {}

  describe(): string {
    return "mock";
  }

  probe(): Promise<boolean> {
    return Promise.resolve(true);
  }

  complete(input: LlmInput): Promise<LlmOutput> {
    const lastUser = [...input.messages].reverse().find((message) => message.role === "user");
    const text = lastUser?.content ?? "";
    const toolReply = [...input.messages].reverse().find((message) => message.role === "tool");
    if (toolReply) {
      return Promise.resolve({ text: `Готово: ${toolReply.content}`, toolCalls: [] });
    }
    if (input.tools.some((tool) => tool.name === "now") && /tool:now/i.test(text)) {
      return Promise.resolve({
        text: "",
        toolCalls: [{ id: "call_now", name: "now", arguments: {} }],
      });
    }
    if (input.tools.some((tool) => tool.name === "calc") && /tool:calc/i.test(text)) {
      const expression = text.split(/tool:calc/i)[1]?.trim() || "2+2";
      return Promise.resolve({
        text: "",
        toolCalls: [{ id: "call_calc", name: "calc", arguments: { expression } }],
      });
    }
    return Promise.resolve({ text: `Эхо (заглушка): ${text}`, toolCalls: [] });
  }
}
