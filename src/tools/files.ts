import fs from "node:fs/promises";
import path from "node:path";
import type { ToolHandler } from "../kernel/types.js";
import { EchoError } from "../kernel/types.js";
import { readString } from "../util/json.js";

export function filesTool(root: string): ToolHandler {
  return {
    spec: {
      name: "files",
      description: "Читать и писать файлы только внутри рабочего каталога Эха",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "write", "list"] },
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      risk: "write",
    },
    async execute(args) {
      const action = readString(args, "action");
      if (action === "list") {
        const target = resolveInside(root, readString(args, "path", "."));
        const entries = await fs.readdir(target, { withFileTypes: true });
        const listing = entries.map((entry) => `${entry.isDirectory() ? "dir" : "file"} ${entry.name}`);
        return { ok: true, content: listing.join("\n") || "(пусто)" };
      }
      const target = resolveInside(root, readString(args, "path"));
      if (action === "read") {
        const content = await fs.readFile(target, "utf8");
        return { ok: true, content };
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, readString(args, "content"), "utf8");
      return { ok: true, content: `Записал ${path.relative(root, target)}` };
    },
  };
}

function resolveInside(root: string, relative: string): string {
  const resolved = path.resolve(root, relative);
  const normalizedRoot = path.resolve(root);
  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new EchoError("path_escape", "Путь выходит за рабочий каталог Эха");
  }
  return resolved;
}
