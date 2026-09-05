import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ChannelAdapter, Reply, Turn } from "../kernel/types.js";

export class CliChannel implements ChannelAdapter {
  readonly id = "cli";
  readonly kind = "channel" as const;
  private stopping = false;

  async start(handle: (turn: Turn) => Promise<Reply>): Promise<void> {
    const rl = readline.createInterface({ input, output });
    output.write("Эхо слушает. Пустая строка — выход.\n");
    while (!this.stopping) {
      const text = (await rl.question("ты> ")).trim();
      if (!text) break;
      try {
        const reply = await handle({ channel: this.id, speaker: "owner", text });
        printReply(reply);
      } catch (error) {
        output.write(`ошибка> ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
    rl.close();
  }

  async stop(): Promise<void> {
    this.stopping = true;
  }
}

export function printReply(reply: Reply): void {
  if (reply.toolTrace.length) {
    for (const item of reply.toolTrace) {
      output.write(`tool ${item.name} ${item.ok ? "ok" : "fail"}: ${item.content.slice(0, 200)}\n`);
    }
  }
  output.write(`эхо [${reply.provider.llm}${reply.provider.tts ? `/${reply.provider.tts}` : ""}]> ${reply.text}\n`);
}
