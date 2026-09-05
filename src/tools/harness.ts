import { spawn } from "node:child_process";
import type { ToolHandler } from "../kernel/types.js";
import { EchoError } from "../kernel/types.js";
import { readString } from "../util/json.js";
import { redact } from "../util/redact.js";

export function harnessTool(name: string, command: string, args: string[]): ToolHandler {
  return {
    spec: {
      name: "harness",
      description: `Отдать задачу внешнему харнессу ${name}. Так подключаются OpenClaw, Claude Code, HA и любой CLI`,
      parameters: {
        type: "object",
        properties: {
          task: { type: "string" },
        },
        required: ["task"],
        additionalProperties: false,
      },
      risk: "exec",
    },
    async execute(input) {
      const task = readString(input, "task");
      const output = await runHarness(command, [...args, task]);
      return { ok: output.code === 0, content: redact(output.text) };
    },
  };
}

function runHarness(command: string, args: string[]): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { timeout: 60_000 });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => {
      reject(new EchoError("harness_missing", `Харнесс не запустился: ${error.message}`));
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, text: Buffer.concat(chunks).toString("utf8").slice(0, 6000) || "(пусто)" });
    });
  });
}
