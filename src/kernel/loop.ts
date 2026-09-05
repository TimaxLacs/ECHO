import { randomUUID } from "node:crypto";
import type { EchoConfig } from "../config/schema.js";
import { redact } from "../util/redact.js";
import { firstWorking } from "./chain.js";
import { systemPrompt } from "./prompt.js";
import type { Registry } from "./registry.js";
import type { ChatMessage, LlmOutput, Reply, ToolContext, ToolTrace, Turn } from "./types.js";
import { EchoError } from "./types.js";

export class AgentLoop {
  private readonly history: ChatMessage[] = [];

  constructor(
    private readonly config: EchoConfig,
    private readonly registry: Registry,
    private readonly home: string,
  ) {}

  async handle(turn: Turn): Promise<Reply> {
    const heard = await this.inputText(turn);
    if (!heard.text.trim()) throw new EchoError("empty_turn", "Пустое обращение");

    const memory = await this.memory().core(turn.speaker);
    const tools = [...this.registry.tools.values()];
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(this.config, memory, tools.map((tool) => tool.spec.name)) },
      ...this.history.slice(-this.config.limits.historyTurns),
      { role: "user", content: heard.text },
    ];

    const trace: ToolTrace[] = [];
    const completion = await this.think(messages, trace, {
      speaker: turn.speaker,
      cwd: this.config.tools.files.root,
      memory: this.memory(),
      home: this.home,
    });

    this.history.push({ role: "user", content: heard.text });
    this.history.push({ role: "assistant", content: completion.output.text });

    const spoken = await this.maybeSpeak(completion.output.text);
    return {
      text: completion.output.text,
      audio: spoken.audio,
      toolTrace: trace,
      provider: { llm: completion.llmId, tts: spoken.ttsId, stt: heard.sttId },
    };
  }

  private async inputText(turn: Turn): Promise<{ text: string; sttId?: string }> {
    if (turn.text?.trim()) return { text: turn.text.trim() };
    if (!turn.audio) return { text: "" };
    const used = await firstWorking(this.config.slots.stt, async (id) => {
      const provider = this.registry.stt.get(id);
      if (!provider) throw new EchoError("slot_missing", `stt/${id} нет`);
      return provider.transcribe(turn.audio as Buffer, this.config.identity.language);
    });
    return { text: used.value, sttId: used.id };
  }

  private async think(
    messages: ChatMessage[],
    trace: ToolTrace[],
    ctx: ToolContext,
  ): Promise<{ output: LlmOutput; llmId: string }> {
    let llmId = "";
    for (let round = 0; round < this.config.limits.maxToolRounds; round += 1) {
      const used = await firstWorking(this.config.slots.llm, async (id) => {
        const provider = this.registry.llm.get(id);
        if (!provider) throw new EchoError("slot_missing", `llm/${id} нет`);
        return provider.complete({ messages, tools: [...this.registry.tools.values()].map((tool) => tool.spec) });
      });
      llmId = used.id;
      if (!used.value.toolCalls.length) return { output: used.value, llmId };
      messages.push({ role: "assistant", content: used.value.text, toolCalls: used.value.toolCalls });
      for (const call of used.value.toolCalls) {
        const result = await this.runTool(call.name, call.arguments, ctx);
        trace.push(result);
        messages.push({
          role: "tool",
          name: call.name,
          toolCallId: call.id || randomUUID(),
          content: result.content,
        });
      }
    }
    throw new EchoError("tool_loop", "Слишком много раундов инструментов");
  }

  private async runTool(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolTrace> {
    const handler = this.registry.tools.get(name);
    if (!handler) return { name, ok: false, content: `Нет инструмента ${name}` };
    try {
      const result = await handler.execute(args, ctx);
      return { name, ok: result.ok, content: redact(result.content) };
    } catch (error) {
      const content = error instanceof Error ? error.message : String(error);
      return { name, ok: false, content: redact(content) };
    }
  }

  private async maybeSpeak(text: string): Promise<{ audio?: Buffer; ttsId?: string }> {
    if (!text.trim()) return {};
    try {
      const used = await firstWorking(this.config.slots.tts, async (id) => {
        const provider = this.registry.tts.get(id);
        if (!provider) throw new EchoError("slot_missing", `tts/${id} нет`);
        return provider.synthesize(text, this.config.identity.voice);
      });
      return { audio: used.value, ttsId: used.id };
    } catch {
      return {};
    }
  }

  private memory() {
    const id = this.config.slots.memory[0];
    const provider = id ? this.registry.memory.get(id) : undefined;
    if (!provider) throw new EchoError("slot_missing", "Слот памяти пуст");
    return provider;
  }
}
