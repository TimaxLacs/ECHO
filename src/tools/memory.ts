import type { ToolHandler } from "../kernel/types.js";
import { readString } from "../util/json.js";

export function memoryTool(): ToolHandler {
  return {
    spec: {
      name: "memory",
      description: "Искать или записывать факты в долгую память Эха",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["recall", "remember"] },
          query: { type: "string" },
          note: { type: "string" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      risk: "write",
    },
    async execute(args, ctx) {
      const action = readString(args, "action");
      if (action === "remember") {
        const note = readString(args, "note");
        await ctx.memory.remember(note, ctx.speaker);
        return { ok: true, content: "Записал в память." };
      }
      const query = readString(args, "query", "");
      const found = await ctx.memory.recall(query, ctx.speaker);
      return { ok: true, content: found };
    },
  };
}
