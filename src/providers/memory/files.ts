import fs from "node:fs/promises";
import path from "node:path";
import { memoryDir } from "../../config/paths.js";
import type { MemoryProvider } from "../../kernel/types.js";
import { redact } from "../../util/redact.js";

export class FileMemory implements MemoryProvider {
  readonly kind = "memory" as const;
  private readonly root: string;

  constructor(
    readonly id: string,
    home: string,
    private readonly secrets: readonly string[] = [],
  ) {
    this.root = memoryDir(home);
  }

  async probe(): Promise<boolean> {
    await fs.mkdir(this.root, { recursive: true });
    return true;
  }

  async core(speaker = "owner"): Promise<string> {
    const user = await readIfExists(path.join(this.root, "USER.md"));
    const memory = await readIfExists(path.join(this.root, "MEMORY.md"));
    const today = tail(await readIfExists(path.join(this.root, `${todayStamp()}.md`)), 4000);
    return [
      user && `# Профиль\n${user}`,
      memory && `# Память\n${memory}`,
      today && `# Сегодня (${speaker})\n${today}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  async recall(query: string): Promise<string> {
    const trimmed = query.trim();
    if (!trimmed) return this.core();
    await fs.mkdir(this.root, { recursive: true });
    const names = await fs.readdir(this.root);
    const needles = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const hits: string[] = [];
    for (const name of names) {
      if (!name.endsWith(".md")) continue;
      const text = await readIfExists(path.join(this.root, name));
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const hay = line.toLowerCase();
        if (!needles.length || needles.some((needle) => hay.includes(needle))) hits.push(line);
      }
    }
    const clipped = hits.slice(-40);
    return clipped.length ? clipped.join("\n") : "В памяти нет совпадений.";
  }

  async remember(note: string): Promise<void> {
    const clean = redact(note, this.secrets).trim().slice(0, 2000);
    if (!clean) return;
    await fs.mkdir(this.root, { recursive: true });
    const line = `- ${new Date().toISOString()} ${clean}\n`;
    await fs.appendFile(path.join(this.root, "MEMORY.md"), line, "utf8");
    await fs.appendFile(path.join(this.root, `${todayStamp()}.md`), line, "utf8");
  }

  async journal(user: string, reply: string): Promise<void> {
    const left = redact(user, this.secrets).trim().slice(0, 500);
    const right = redact(reply, this.secrets).trim().slice(0, 500);
    if (!left && !right) return;
    await fs.mkdir(this.root, { recursive: true });
    const stamp = new Date().toISOString();
    const block = `- ${stamp} пользователь: ${left}\n- ${stamp} эхо: ${right}\n`;
    await fs.appendFile(path.join(this.root, `${todayStamp()}.md`), block, "utf8");
  }
}

async function readIfExists(file: string): Promise<string> {
  try {
    return (await fs.readFile(file, "utf8")).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function tail(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(text.length - max);
}
