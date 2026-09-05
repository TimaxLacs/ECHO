import type { ToolHandler } from "../kernel/types.js";

export function nowTool(): ToolHandler {
  return {
    spec: {
      name: "now",
      description: "Текущие дата, время и часовой пояс машины, где крутится Эхо",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      risk: "read",
    },
    async execute() {
      const now = new Date();
      return {
        ok: true,
        content: `${now.toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        data: { iso: now.toISOString() },
      };
    },
  };
}
