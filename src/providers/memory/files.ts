import fs from "node:fs/promises";
import path from "node:path";
import { memoryDir } from "../../config/paths.js";
import type { MemoryProvider } from "../../kernel/types.js";

export class FileMemory implements MemoryProvider {
  readonly kind = "memory" as const;
  private readonly root: string;

  constructor(
    readonly id: string,
    home: string,
  ) {
    this.root = memoryDir(home);
  }

  async probe(): Promise<boolean> {
    await fs.mkdir(this.root, { recursive: true });
    return true;
  }

  async core(speaker = "owner"): Promise<string> {
    const user = await readIfExists(this.file("USER.md"));
    const memory = await readIfExists(this.file("MEMORY.md"));
    const today = await readIfExists(this.file(`${todayStamp()}.md`));
    return ["# Профиль", user, "# Память", memory, `# Сегодня (${speaker})`, today]
      .filter(Boolean)
      .join("\n\n");
  }

  async recall(query: string, speaker = "owner"): Promise<string> {
    const haystack = await this.core(speaker);
    if (!query.trim()) return haystack;
    const hits = haystack
      .split("\n")
      .filter((line) => line.toLowerCase().includes(query.toLowerCase()));
    return hits.length ? hits.join("\n") : "В памяти нет точных совпадений.";
  }

  async remember(note: string, _speaker = "owner"): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    const file = this.file(`${todayStamp()}.md`);
    const stamp = new Date().toISOString();
    await fs.appendFile(file, `- ${stamp} ${note.trim()}\n`, "utf8");
  }

  private file(name: string): string {
    return path.join(this.root, name);
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
