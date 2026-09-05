import http from "node:http";
import type { EchoConfig } from "../config/schema.js";
import type { ChannelAdapter, Reply, SlotHealth, Turn } from "../kernel/types.js";
import { dashboardHtml } from "./dashboard.js";

export class HttpChannel implements ChannelAdapter {
  readonly id = "http";
  readonly kind = "channel" as const;
  private server: http.Server | null = null;

  constructor(
    private readonly config: EchoConfig,
    private readonly doctor: () => Promise<SlotHealth[]>,
  ) {}

  async start(handle: (turn: Turn) => Promise<Reply>): Promise<void> {
    const host = this.config.channels.http?.host ?? "127.0.0.1";
    const port = this.config.channels.http?.port ?? 43171;
    this.server = http.createServer((req, res) => {
      void route(req, res, handle, this.doctor, this.config);
    });
    await listen(this.server, host, port);
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function route(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  handle: (turn: Turn) => Promise<Reply>,
  doctor: () => Promise<SlotHealth[]>,
  config: EchoConfig,
): Promise<void> {
  try {
    if (req.method === "GET" && req.url === "/") {
      return html(res, dashboardHtml(config, await doctor()));
    }
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true, slots: await doctor() });
    }
    if (req.method === "POST" && req.url === "/ask") {
      const body = JSON.parse(await readBody(req)) as { text?: string; speaker?: string };
      if (!body.text?.trim()) return json(res, 400, { error: "Нужен text" });
      const reply = await handle({ channel: "http", speaker: body.speaker ?? "owner", text: body.text });
      return json(res, 200, { text: reply.text, provider: reply.provider, toolTrace: reply.toolTrace });
    }
    json(res, 404, { error: "Нет такого маршрута" });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function html(res: http.ServerResponse, body: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

function listen(server: http.Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on("error", reject);
  });
}
