import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { EchoConfig } from "../config/schema.js";
import type { Registry } from "../kernel/registry.js";
import type { ToolContext, ToolHandler, ToolResult } from "../kernel/types.js";
import { EchoError } from "../kernel/types.js";
import { redact } from "../util/redact.js";
import { evalMath } from "./calc.js";
import { assertPublicHttpUrl, resolveInside } from "./guard.js";

const execFileAsync = promisify(execFile);
const SHELL_META = /[;&|`$<>\\\n\r]/;

export function registerBuiltinTools(registry: Registry, config: EchoConfig, home: string): void {
  const enabled = new Set(config.tools.enabled);
  const tools: ToolHandler[] = [
    nowTool(),
    calcTool(),
    memoryRecallTool(),
    memoryRememberTool(),
    filesListTool(config.tools.files.root),
    filesReadTool(config.tools.files.root),
    filesWriteTool(config.tools.files.root),
    shellTool(config.tools.shell.allow, config.tools.shell.timeoutMs, config.tools.files.root),
    httpTool(config.tools.http.timeoutMs, config.tools.http.maxBytes, config.tools.http.enabled),
    weatherTool(),
  ];
  for (const tool of tools) {
    const group = tool.spec.name.split("_")[0] ?? tool.spec.name;
    if (enabled.has(group) || enabled.has(tool.spec.name)) registry.registerTool(tool);
  }
  void home;
}

function nowTool(): ToolHandler {
  return {
    spec: {
      name: "now",
      description: "Текущие дата и время на машине Эха",
      risk: "read",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    execute: () => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const text = new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: zone,
      }).format(new Date());
      return Promise.resolve({ ok: true, content: `${text} (${zone})` });
    },
  };
}

function calcTool(): ToolHandler {
  return {
    spec: {
      name: "calc",
      description: "Посчитать арифметическое выражение",
      risk: "read",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "Например (2+2)*3" } },
        required: ["expression"],
        additionalProperties: false,
      },
    },
    async execute(args) {
      const expression = stringArg(args, "expression");
      try {
        return { ok: true, content: String(evalMath(expression)) };
      } catch (error) {
        return { ok: false, content: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

function memoryRecallTool(): ToolHandler {
  return {
    spec: {
      name: "memory_recall",
      description: "Найти заметку в памяти владельца",
      risk: "read",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    execute(args, ctx) {
      return ctx.memory.recall(stringArg(args, "query"), ctx.speaker).then((content) => ({ ok: true, content }));
    },
  };
}

function memoryRememberTool(): ToolHandler {
  return {
    spec: {
      name: "memory_remember",
      description: "Запомнить факт о владельце",
      risk: "write",
      parameters: {
        type: "object",
        properties: { note: { type: "string" } },
        required: ["note"],
        additionalProperties: false,
      },
    },
    async execute(args, ctx) {
      await ctx.memory.remember(stringArg(args, "note"), ctx.speaker);
      return { ok: true, content: "Запомнил." };
    },
  };
}

function filesListTool(root: string): ToolHandler {
  return {
    spec: {
      name: "files_list",
      description: "Список файлов в песочнице Эха",
      risk: "read",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        additionalProperties: false,
      },
    },
    async execute(args) {
      const dir = resolveInside(root, optionalString(args, "path") || ".");
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const lines = entries
        .slice(0, 200)
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
      return { ok: true, content: lines.join("\n") || "(пусто)" };
    },
  };
}

function filesReadTool(root: string): ToolHandler {
  return {
    spec: {
      name: "files_read",
      description: "Прочитать текстовый файл в песочнице",
      risk: "read",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
    async execute(args) {
      const file = resolveInside(root, stringArg(args, "path"));
      const stat = await fs.stat(file);
      if (!stat.isFile()) return { ok: false, content: "Это не файл" };
      if (stat.size > 200_000) return { ok: false, content: "Файл слишком большой" };
      return { ok: true, content: await fs.readFile(file, "utf8") };
    },
  };
}

function filesWriteTool(root: string): ToolHandler {
  return {
    spec: {
      name: "files_write",
      description: "Записать текстовый файл в песочнице",
      risk: "write",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    async execute(args) {
      const file = resolveInside(root, stringArg(args, "path"));
      const content = stringArg(args, "content");
      if (Buffer.byteLength(content) > 200_000) return { ok: false, content: "Слишком длинный текст" };
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content, "utf8");
      return { ok: true, content: `Записал ${path.relative(root, file) || path.basename(file)}` };
    },
  };
}

function shellTool(allow: string[], timeoutMs: number, cwd: string): ToolHandler {
  const allowed = new Set(allow);
  return {
    spec: {
      name: "shell",
      description: `Команда из белого списка: ${allow.join(", ") || "список пуст"}. Без оболочки и без метасимволов.`,
      risk: "exec",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
        additionalProperties: false,
      },
    },
    async execute(args) {
      const command = stringArg(args, "command").trim();
      if (!command) return { ok: false, content: "Пустая команда" };
      if (SHELL_META.test(command)) return { ok: false, content: "Метасимволы оболочки запрещены" };
      const [bin, ...rest] = command.split(/\s+/);
      if (!bin || bin.includes("/") || !allowed.has(bin)) {
        return { ok: false, content: `Команда не из белого списка: ${bin || command}` };
      }
      try {
        const { stdout, stderr } = await execFileAsync(bin, rest, {
          cwd,
          timeout: timeoutMs,
          shell: false,
          windowsHide: true,
          encoding: "utf8",
        });
        const text = `${stdout}${stderr}`.trim();
        return { ok: true, content: text || "(пусто)" };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, content: message.slice(0, 500) };
      }
    },
  };
}

function httpTool(timeoutMs: number, maxBytes: number, enabled: boolean): ToolHandler {
  return {
    spec: {
      name: "http_fetch",
      description: "GET или POST публичного URL, вернуть текст до лимита. Внутренние адреса запрещены.",
      risk: "read",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          method: { type: "string", enum: ["GET", "POST"] },
          body: { type: "string" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
    async execute(args) {
      if (!enabled) return { ok: false, content: "HTTP-инструмент выключен" };
      const method = (optionalString(args, "method") || "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") return { ok: false, content: "Только GET или POST" };
      const url = await assertPublicHttpUrl(stringArg(args, "url"));
      const response = await fetch(url, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "echo-agent" },
        body: method === "POST" ? optionalString(args, "body") : undefined,
      });
      if (response.status >= 300 && response.status < 400) {
        return { ok: false, content: "Редирект запрещён" };
      }
      const raw = await response.text();
      return {
        ok: response.ok,
        content: `${response.status}\n${raw.slice(0, maxBytes)}`,
      };
    },
  };
}

function weatherTool(): ToolHandler {
  return {
    spec: {
      name: "weather",
      description: "Текущая погода в месте через Open-Meteo, без ключа",
      risk: "read",
      parameters: {
        type: "object",
        properties: { place: { type: "string", description: "Город" } },
        required: ["place"],
        additionalProperties: false,
      },
    },
    async execute(args) {
      const place = stringArg(args, "place");
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=ru`;
      const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(15_000) });
      if (!geoResponse.ok) return { ok: false, content: `Геокодер ${geoResponse.status}` };
      const geo = (await geoResponse.json()) as {
        results?: Array<{ name: string; country?: string; latitude: number; longitude: number; timezone?: string }>;
      };
      const hit = geo.results?.[0];
      if (!hit) return { ok: false, content: `Место не найдено: ${place}` };
      const forecastUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
        `&current=temperature_2m,weather_code,wind_speed_10m&timezone=${encodeURIComponent(hit.timezone || "auto")}`;
      const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(15_000) });
      if (!forecastResponse.ok) return { ok: false, content: `Погода ${forecastResponse.status}` };
      const forecast = (await forecastResponse.json()) as {
        current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
      };
      const current = forecast.current;
      if (!current) return { ok: false, content: "Нет текущей погоды" };
      const where = [hit.name, hit.country].filter(Boolean).join(", ");
      return {
        ok: true,
        content: `${where}: ${current.temperature_2m ?? "?"}°C, ветер ${current.wind_speed_10m ?? "?"} м/с, код ${current.weather_code ?? "?"}`,
      };
    },
  };
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new EchoError("tool_args", `Нужен текст в поле ${key}`);
  }
  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

export async function runTool(
  registry: Registry,
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  secrets: readonly string[],
): Promise<ToolResult> {
  const handler = registry.tools.get(name);
  if (!handler) return { ok: false, content: `Нет инструмента ${name}` };
  try {
    const result = await handler.execute(args, ctx);
    return { ok: result.ok, content: redact(result.content, secrets) };
  } catch (error) {
    const content = error instanceof Error ? error.message : String(error);
    return { ok: false, content: redact(content, secrets) };
  }
}
