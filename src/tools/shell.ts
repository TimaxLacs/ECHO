import { spawn } from "node:child_process";
import type { ToolHandler } from "../kernel/types.js";
import { EchoError } from "../kernel/types.js";
import { readString } from "../util/json.js";
import { redact } from "../util/redact.js";

export function shellTool(allow: string[], timeoutMs: number): ToolHandler {
  return {
    spec: {
      name: "shell",
      description: "Запустить разрешённую команду на машине Эха. Только префиксы из allow-списка",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
        additionalProperties: false,
      },
      risk: "exec",
    },
    async execute(args, ctx) {
      const command = readString(args, "command");
      const binary = command.trim().split(/\s+/)[0] ?? "";
      if (!allow.some((prefix) => command === prefix || command.startsWith(`${prefix} `) || binary === prefix)) {
        throw new EchoError("shell_denied", `Команда не в allow-списке: ${binary}`);
      }
      const output = await runCommand(command, ctx.cwd, timeoutMs);
      return { ok: output.code === 0, content: redact(output.text) };
    },
  };
}

function runCommand(command: string, cwd: string, timeoutMs: number): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, timeout: timeoutMs });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, text: Buffer.concat(chunks).toString("utf8").slice(0, 4000) || "(нет вывода)" });
    });
  });
}
