import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { EchoRuntime } from "../kernel/runtime.js";
import type { Reply } from "../kernel/types.js";

export function printReply(reply: Reply): void {
  console.log(reply.text);
  const model = reply.provider.model ? ` / ${reply.provider.model}` : "";
  console.log(`\n— ${reply.provider.llm}${model}`);
  for (const step of reply.toolTrace) {
    console.log(`  ${step.ok ? "✓" : "×"} ${step.name}: ${step.content.slice(0, 200)}`);
  }
  if (reply.audio) console.log(`  голос: ${reply.audio.length} байт`);
}

export async function chatLoop(runtime: EchoRuntime, provider?: string): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log("Эхо слушает. Пустая строка или /exit — выйти.");
  try {
    while (true) {
      const line = await rl.question("ты › ");
      if (!line.trim() || line.trim() === "/exit") break;
      const reply = await runtime.handle({ channel: "cli", speaker: "owner", text: line, provider });
      console.log(`эхо › ${reply.text}`);
      if (reply.toolTrace.length) {
        console.log(reply.toolTrace.map((step) => `${step.name}: ${step.content}`).join("\n"));
      }
    }
  } finally {
    rl.close();
  }
}
