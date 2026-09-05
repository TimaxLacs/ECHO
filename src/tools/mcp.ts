import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { McpServerConfig } from "../config/schema.js";
import type { ToolHandler, ToolResult } from "../kernel/types.js";
import { EchoError } from "../kernel/types.js";

type JsonRpc = {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: { tools?: McpTool[]; content?: Array<{ text?: string }> };
  error?: { message?: string };
};

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export async function loadMcpTools(servers: McpServerConfig[]): Promise<ToolHandler[]> {
  const tools: ToolHandler[] = [];
  for (const server of servers) {
    const client = await McpClient.connect(server);
    for (const tool of await client.listTools()) {
      tools.push(client.asHandler(server.name, tool));
    }
  }
  return tools;
}

class McpClient {
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<number, (value: JsonRpc) => void>();

  private constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onData(chunk));
  }

  static async connect(server: McpServerConfig): Promise<McpClient> {
    const child = spawn(server.command, server.args, {
      env: { ...process.env, ...server.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const client = new McpClient(child);
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "echo-agent", version: "0.1.0" },
    });
    await client.notify("notifications/initialized", {});
    return client;
  }

  async listTools(): Promise<McpTool[]> {
    const response = await this.request("tools/list", {});
    return response.result?.tools ?? [];
  }

  asHandler(serverName: string, tool: McpTool): ToolHandler {
    return {
      spec: {
        name: `${serverName}.${tool.name}`,
        description: tool.description ?? `MCP ${serverName}:${tool.name}`,
        parameters: tool.inputSchema ?? { type: "object", properties: {} },
        risk: "write",
      },
      execute: async (args) => this.call(tool.name, args),
    };
  }

  private async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const response = await this.request("tools/call", { name, arguments: args });
    const text = response.result?.content?.map((part) => part.text ?? "").join("\n") ?? "";
    return { ok: !response.error, content: text || JSON.stringify(response.result ?? response.error) };
  }

  private request(method: string, params: unknown): Promise<JsonRpc> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new EchoError("mcp_timeout", `MCP ${method} не ответил`));
      }, 10_000);
      this.pending.set(id, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private async notify(method: string, params: unknown): Promise<void> {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private send(payload: JsonRpc): void {
    const body = JSON.stringify(payload);
    this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    while (true) {
      const framed = takeFrame(this.buffer);
      if (!framed) return;
      this.buffer = framed.rest;
      const message = JSON.parse(framed.body) as JsonRpc;
      if (message.id != null) this.pending.get(message.id)?.(message);
    }
  }
}

function takeFrame(buffer: string): { body: string; rest: string } | null {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    const lineEnd = buffer.indexOf("\n");
    if (lineEnd === -1) return null;
    return { body: buffer.slice(0, lineEnd), rest: buffer.slice(lineEnd + 1) };
  }
  const match = buffer.slice(0, headerEnd).match(/Content-Length:\s*(\d+)/i);
  if (!match) return null;
  const length = Number(match[1]);
  const start = headerEnd + 4;
  if (buffer.length < start + length) return null;
  return { body: buffer.slice(start, start + length), rest: buffer.slice(start + length) };
}
