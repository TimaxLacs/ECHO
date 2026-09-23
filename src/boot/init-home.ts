import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "../config/defaults.js";
import { ensureHome } from "../config/load.js";
import { configPath, echoHome } from "../config/paths.js";

const USER = `# Владелец

Имя:
Язык: русский

Эхо — личный агент. Отвечай коротко и по делу, голосом владельца, не чужим персонажем.
`;

const MEMORY = `# Память

Пока пусто. Сюда попадают факты, которые просят запомнить.
`;

export async function initHome(explicit?: string): Promise<{ home: string; config: string }> {
  const home = echoHome(explicit);
  await ensureHome(home);
  const file = configPath(home);
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, `${JSON.stringify(defaultConfig(), null, 2)}\n`, { mode: 0o600 });
  }
  await writeIfMissing(path.join(home, "memory", "USER.md"), USER);
  await writeIfMissing(path.join(home, "memory", "MEMORY.md"), MEMORY);
  return { home, config: file };
}

async function writeIfMissing(file: string, contents: string): Promise<void> {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, contents, "utf8");
  }
}
