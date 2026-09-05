import fs from "node:fs/promises";
import path from "node:path";
import { writeDefaultConfig } from "../config/load.js";
import { echoHome, memoryDir, pluginsDir, voicesDir } from "../config/paths.js";

export async function initHome(homeOverride?: string): Promise<{ home: string; config: string }> {
  const home = echoHome(homeOverride);
  await fs.mkdir(memoryDir(home), { recursive: true });
  await fs.mkdir(voicesDir(home), { recursive: true });
  await fs.mkdir(path.join(home, "workspace"), { recursive: true });
  await fs.mkdir(pluginsDir(home), { recursive: true });
  await writeIfMissing(path.join(memoryDir(home), "USER.md"), "# Владелец\n\n- Голос: ещё не записан. Положи owner.wav в voices/.\n");
  await writeIfMissing(path.join(memoryDir(home), "MEMORY.md"), "# Долгая память\n\n");
  const example = path.join(pluginsDir(home), "ping.echo-plugin.mjs");
  await writeIfMissing(example, examplePlugin());
  const config = await writeDefaultConfig(home);
  return { home, config };
}

async function writeIfMissing(file: string, content: string): Promise<void> {
  try {
    await fs.writeFile(file, content, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

function examplePlugin(): string {
  return `export function register(api) {
  api.registerTool({
    spec: {
      name: "ping",
      description: "Проверка, что плагин подхватился",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      risk: "read",
    },
    async execute() {
      return { ok: true, content: "pong" };
    },
  });
}
`;
}
