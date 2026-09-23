import type { ProviderConfig } from "../../config/schema.js";
import type { ChatMessage, LlmInput, LlmOutput, LlmProvider, ToolCall } from "../../kernel/types.js";
import { EchoError } from "../../kernel/types.js";
import { parseJsonObject } from "../../util/json.js";
import { redact } from "../../util/redact.js";
import { endpointHost, resolveLlmEndpoint, type ResolvedLlm } from "./presets.js";

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
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly secrets: readonly string[] = [],
  ) {}

  get model(): string {
    return resolveLlmEndpoint(this.config).model;
  }

  describe(): string {
    const endpoint = resolveLlmEndpoint(this.config);
    return `${endpoint.model || "модель не задана"} @ ${endpointHost(endpoint.baseUrl)}`;
  }

  async probe(): Promise<boolean> {
    const endpoint = resolveLlmEndpoint(this.config);
    if (!endpoint.baseUrl || !endpoint.model) return false;
    if (endpoint.sendKey && !endpoint.apiKey) return false;
    const response = await this.fetchImpl(`${endpoint.baseUrl}/models`, {
      headers: endpoint.headers,
      signal: AbortSignal.timeout(Math.min(endpoint.timeoutMs, 8_000)),
    }).catch(() => null);
    return Boolean(response?.ok);
  }

  async complete(input: LlmInput): Promise<LlmOutput> {
    const endpoint = this.requireEndpoint();
    try {
      return await this.call(endpoint, input, input.tools.length > 0);
    } catch (error) {
      if (error instanceof EchoError && error.code === "llm_tools_rejected" && input.tools.length > 0) {
        return this.call(endpoint, input, false);
      }
      throw error;
    }
  }

  private requireEndpoint(): ResolvedLlm {
    const endpoint = resolveLlmEndpoint(this.config);
    if (!endpoint.baseUrl) throw new EchoError("llm_config", `${this.id}: пустой baseUrl`);
    if (!endpoint.model) throw new EchoError("llm_config", `${this.id}: не задана модель`);
    if (endpoint.sendKey && !endpoint.apiKey) throw new EchoError("llm_config", `${this.id}: нет ключа`);
    return endpoint;
  }

  private async call(endpoint: ResolvedLlm, input: LlmInput, withTools: boolean): Promise<LlmOutput> {
    const body: Record<string, unknown> = {
      model: endpoint.model,
      messages: toOpenAiMessages(input.messages),
      max_tokens: 1024,
    };
    if (withTools && input.tools.length) {
      body.tools = input.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${endpoint.baseUrl}/chat/completions`, {
        method: "POST",
        headers: endpoint.headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(endpoint.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EchoError("llm_http", `${this.id}: ${redact(message, this.secrets)}`);
    }

    const raw = await response.text();
    if (!response.ok) {
      const detail = redact(raw, this.secrets).slice(0, 300);
      if (withTools && toolsRejected(response.status, raw)) {
        throw new EchoError("llm_tools_rejected", `${this.id}: ${response.status} ${detail}`);
      }
      throw new EchoError("llm_http", `${this.id}: ${response.status} ${detail}`);
    }

    let payload: ChatCompletion;
    try {
      payload = JSON.parse(raw) as ChatCompletion;
    } catch {
      throw new EchoError("llm_http", `${this.id}: ответ не JSON`);
    }
    return fromOpenAi(payload);
  }
}

function toolsRejected(status: number, body: string): boolean {
  if (status < 400 || status >= 500 || status === 401 || status === 403) return false;
  return /tool/i.test(body);
}

function toOpenAiMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
      };
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
  const toolCalls: ToolCall[] = [];
  for (const [index, call] of (message?.tool_calls ?? []).entries()) {
    if (!call.function?.name) continue;
    toolCalls.push({
      id: call.id || `call_${index}`,
      name: call.function.name,
      arguments: parseJsonObject(call.function.arguments ?? "{}"),
    });
  }
  return { text: message?.content?.trim() ?? "", toolCalls };
}
