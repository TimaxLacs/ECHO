import fs from "node:fs/promises";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { applySettings, viewSettings, type SettingsPatch } from "../config/settings.js";
import type { LoadedConfig } from "../config/load.js";
import type { EchoRuntime } from "../kernel/runtime.js";
import { EchoError } from "../kernel/types.js";
import { redact } from "../util/redact.js";

const htmlPath = fileURLToPath(new URL("../web/index.html", import.meta.url));
const MAX_BODY = 1_000_000;

export type RunningServer = {
  url: string;
  close(): Promise<void>;
};

export function startServer(
  runtime: EchoRuntime,
  port: number,
  getLoaded: () => LoadedConfig,
  setLoaded: (loaded: LoadedConfig) => void,
): Promise<RunningServer> {
  const host = runtime.config.channels.http.host;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    return Promise.reject(new EchoError("http_host", "Веб Эха слушает только localhost"));
  }

  const server = http.createServer((req, res) => {
    void route(req, res, runtime, getLoaded, setLoaded).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: redact(message, runtime.secrets) });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      const bound = typeof address === "object" && address ? address.port : port;
      resolve({
        url: `http://${host}:${bound}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}

async function route(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  runtime: EchoRuntime,
  getLoaded: () => LoadedConfig,
  setLoaded: (loaded: LoadedConfig) => void,
): Promise<void> {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/") {
    const html = await fs.readFile(htmlPath);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(html);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/settings") {
    sendJson(res, 200, viewSettings(runtime.config));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/doctor") {
    sendJson(res, 200, { slots: await runtime.doctor() });
    return;
  }
  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const patch = asPatch(await readJson(req));
    const loaded = await applySettings(getLoaded(), patch);
    runtime.replace(loaded.config, loaded.secrets);
    setLoaded(loaded);
    sendJson(res, 200, viewSettings(runtime.config));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/probe") {
    const body = asRecord(await readJson(req));
    const id = typeof body.provider === "string" ? body.provider : "";
    const provider = runtime.registry.llm.get(id);
    if (!provider) {
      sendJson(res, 404, { ok: false, error: "Нет такого провайдера" });
      return;
    }
    const ok = await provider.probe().catch(() => false);
    sendJson(res, 200, { ok, detail: ok ? provider.describe() : "не отвечает" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = asRecord(await readJson(req));
    const text = typeof body.text === "string" ? body.text : "";
    const provider = typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : undefined;
    try {
      const reply = await runtime.handle({ channel: "web", speaker: "owner", text, provider });
      sendJson(res, 200, {
        text: reply.text,
        provider: reply.provider,
        toolTrace: reply.toolTrace,
        attempts: reply.attempts,
        audio: reply.audio ? { bytes: reply.audio.length } : undefined,
      });
    } catch (error) {
      if (error instanceof EchoError) {
        sendJson(res, 502, {
          error: redact(error.message, runtime.secrets),
          code: error.code,
          attempts: (error.attempts ?? []).map((attempt) => ({
            ...attempt,
            detail: redact(attempt.detail, runtime.secrets),
          })),
        });
        return;
      }
      throw error;
    }
    return;
  }
  sendJson(res, 404, { error: "Нет такого пути" });
}

function asPatch(value: unknown): SettingsPatch {
  const body = asRecord(value);
  const patch: SettingsPatch = {};
  const identity = asRecord(body.identity);
  if (Object.keys(identity).length) {
    patch.identity = {
      name: typeof identity.name === "string" ? identity.name : undefined,
      language: typeof identity.language === "string" ? identity.language : undefined,
    };
  }
  if (Array.isArray(body.chain)) {
    patch.chain = body.chain.filter((item): item is string => typeof item === "string");
  }
  const local = endpointPatch(body.local, false);
  const groq = endpointPatch(body.groq, true);
  const openrouter = endpointPatch(body.openrouter, true);
  if (local) patch.local = local;
  if (groq) patch.groq = groq;
  if (openrouter) patch.openrouter = openrouter;
  return patch;
}

function endpointPatch(value: unknown, withKey: boolean): SettingsPatch["groq"] | undefined {
  const record = asRecord(value);
  if (!Object.keys(record).length) return undefined;
  const patch: NonNullable<SettingsPatch["groq"]> = {};
  if (typeof record.baseUrl === "string") patch.baseUrl = record.baseUrl;
  if (typeof record.model === "string") patch.model = record.model;
  if (withKey && record.clearKey === true) patch.clearKey = true;
  if (withKey && typeof record.apiKey === "string" && record.apiKey.trim()) patch.apiKey = record.apiKey.trim();
  return patch;
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new EchoError("body_limit", "Слишком большой запрос");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new EchoError("json", "Нужен JSON");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(json);
}
