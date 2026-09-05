import type { ProviderConfig } from "../../config/schema.js";
import type { LlmInput, LlmOutput, LlmProvider, ToolCall } from "../../kernel/types.js";
import { EchoError } from "../../kernel/types.js";
import { parseJsonObject } from "../../util/json.js";

type ChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

export class OpenAiCompatLlm implements LlmProvider {
  readonly kind = "llm" as const;

  constructor(
    readonly id: string,
    private readonly config: ProviderConfig,
  ) {}

  async probe(): Promise<boolean> {
    if (!this.config.baseUrl) return false;
    const response = await fetch(`${trimSlash(this.config.baseUrl)}/models`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    return Boolean(response?.ok);
  }

  async complete(input: LlmInput): Promise<LlmOutput> {
    const baseUrl = requireBaseUrl(this.id, this.config.baseUrl);
    const model = this.config.model?.trim();
    if (!model) throw new EchoError("llm_config", `${this.id}: не задана модель`);

    const response = await fetch(`${trimSlash(baseUrl)}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(input),
        tools: input.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: input.tools.length ? "auto" : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new EchoError("llm_http", `${this.id}: ${response.status} ${body.slice(0, 400)}`);
    }

    const payload = (await response.json()) as ChatCompletion;
    return fromOpenAi(payload);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }
}

function requireBaseUrl(id: string, baseUrl?: string): string {
  if (!baseUrl?.trim()) throw new EchoError("llm_config", `${id}: пустой baseUrl`);
  return baseUrl.trim();
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function toOpenAiMessages(input: LlmInput) {
  return input.messages.map((message) => {
    if (message.role === "tool") {
      return { role: "tool", content: message.content, tool_call_id: message.toolCallId };
    }
    if (message.toolCalls?.length) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

function fromOpenAi(payload: ChatCompletion): LlmOutput {
  const message = payload.choices?.[0]?.message;
  const toolCalls: ToolCall[] = (message?.tool_calls ?? []).flatMap((call, index) => {
    if (!call.function?.name) return [];
    return [
      {
        id: call.id ?? `call_${index}`,
        name: call.function.name,
        arguments: parseJsonObject(call.function.arguments ?? "{}"),
      },
    ];
  });
  return { text: message?.content?.trim() ?? "", toolCalls };
}
