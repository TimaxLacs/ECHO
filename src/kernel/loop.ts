import { randomUUID } from "node:crypto";
import type { EchoConfig } from "../config/schema.js";
import { runTool } from "../tools/register.js";
import { redact } from "../util/redact.js";
import { firstWorking } from "./chain.js";
import { systemPrompt } from "./prompt.js";
import type { Registry } from "./registry.js";
import type { ChainAttempt, ChatMessage, LlmOutput, Reply, Turn } from "./types.js";
import { EchoError } from "./types.js";

export class AgentLoop {
  private readonly history: ChatMessage[] = [];
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: EchoConfig,
    private readonly registry: Registry,
    private readonly home: string,
    private readonly secrets: readonly string[],
  ) {}

  handle(turn: Turn): Promise<Reply> {
    const run = this.pending.then(() => this.handleInner(turn));
    this.pending = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async handleInner(turn: Turn): Promise<Reply> {
    const heard = await this.inputText(turn);
    if (!heard.text.trim()) throw new EchoError("empty_turn", "Пустое обращение");

    const memory = this.memory();
    const remembered = await memory.core(turn.speaker);
    const tools = [...this.registry.tools.values()].map((tool) => tool.spec);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(this.config, remembered, tools.map((tool) => tool.name)) },
      ...this.history.slice(-this.config.limits.historyTurns),
      { role: "user", content: heard.text },
    ];

    const trace: Reply["toolTrace"] = [];
    const chain = turn.provider ? [turn.provider] : this.config.slots.llm;
    const completion = await this.think(chain, messages, trace, turn.speaker);
    const text = completion.output.text.trim() || "Не получилось собрать ответ.";

    this.history.push({ role: "user", content: heard.text });
    this.history.push({ role: "assistant", content: text });
    await memory.journal(heard.text, text).catch(() => undefined);

    const spoken = await this.maybeSpeak(text);
    return {
      text,
      audio: spoken.audio,
      toolTrace: trace,
      provider: {
        llm: completion.llmId,
        model: completion.model,
        tts: spoken.ttsId,
        stt: heard.sttId,
      },
      attempts: completion.attempts.map((attempt) => ({
        ...attempt,
        detail: redact(attempt.detail, this.secrets),
      })),
    };
  }

  private async inputText(turn: Turn): Promise<{ text: string; sttId?: string }> {
    if (turn.text?.trim()) return { text: turn.text.trim() };
    if (!turn.audio || !this.config.slots.stt.length) return { text: "" };
    const used = await firstWorking(this.config.slots.stt, async (id) => {
      const provider = this.registry.stt.get(id);
      if (!provider) throw new EchoError("slot_missing", `stt/${id} нет`);
      return provider.transcribe(turn.audio as Buffer, this.config.identity.language);
    });
    return { text: used.value, sttId: used.id };
  }

  private async think(
    chain: string[],
    messages: ChatMessage[],
    trace: Reply["toolTrace"],
    speaker: string | undefined,
  ): Promise<{ output: LlmOutput; llmId: string; model?: string; attempts: ChainAttempt[] }> {
    let llmId = "";
    let model: string | undefined;
    let attempts: ChainAttempt[] = [];
    const rounds = this.config.limits.maxToolRounds;
    for (let round = 0; round < rounds; round += 1) {
      const allowTools = round < rounds - 1;
      const specs = allowTools ? [...this.registry.tools.values()].map((tool) => tool.spec) : [];
      const used = await firstWorking(chain, async (id) => {
        const provider = this.registry.llm.get(id);
        if (!provider) throw new EchoError("slot_missing", `llm/${id} нет`);
        return { output: await provider.complete({ messages, tools: specs }), model: provider.model };
      });
      llmId = used.id;
      model = used.value.model;
      attempts = used.attempts;
      const output = used.value.output;
      if (!output.toolCalls.length || !allowTools) {
        return { output, llmId, model, attempts };
      }
      messages.push({ role: "assistant", content: output.text, toolCalls: output.toolCalls });
      for (const call of output.toolCalls) {
        const result = await runTool(this.registry, call.name, call.arguments, {
          speaker,
          memory: this.memory(),
          home: this.home,
        }, this.secrets);
        trace.push({ name: call.name, ok: result.ok, content: result.content });
        messages.push({
          role: "tool",
          name: call.name,
          toolCallId: call.id || randomUUID(),
          content: result.content,
        });
      }
    }
    throw new EchoError("tool_loop", "Слишком много раундов инструментов", attempts);
  }

  private async maybeSpeak(text: string): Promise<{ audio?: Buffer; ttsId?: string }> {
    if (!text.trim() || !this.config.slots.tts.length) return {};
    try {
      const used = await firstWorking(this.config.slots.tts, async (id) => {
        const provider = this.registry.tts.get(id);
        if (!provider) throw new EchoError("slot_missing", `tts/${id} нет`);
        const alive = await provider.probe();
        if (!alive) throw new EchoError("tts_down", `${id} молчит`);
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
