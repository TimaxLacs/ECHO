import type { ToolHandler } from "../kernel/types.js";
import { EchoError } from "../kernel/types.js";
import { readString } from "../util/json.js";
import { redact } from "../util/redact.js";

export function httpTool(timeoutMs: number, enabled: boolean): ToolHandler {
  return {
    spec: {
      name: "http",
      description: "HTTP-запрос наружу. Не передавать секреты в URL и заголовки без нужды",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"] },
          url: { type: "string" },
          body: { type: "string" },
        },
        required: ["url"],
        additionalProperties: false,
      },
      risk: "read",
    },
    async execute(args) {
      if (!enabled) throw new EchoError("http_disabled", "HTTP-инструмент выключен в конфиге");
      const url = readString(args, "url");
      if (!/^https?:\/\//i.test(url)) throw new EchoError("http_url", "Разрешены только http(s) URL");
      const method = readString(args, "method", "GET").toUpperCase();
      const response = await fetch(url, {
        method,
        body: method === "POST" ? readString(args, "body", "") : undefined,
        headers: method === "POST" ? { "content-type": "application/json" } : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = redact((await response.text()).slice(0, 4000));
      return { ok: response.ok, content: `${response.status} ${text}` };
    },
  };
}
