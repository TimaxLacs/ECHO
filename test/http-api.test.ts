import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../src/channels/http.js";
import { defaultConfig } from "../src/config/defaults.js";
import { loadConfig, type LoadedConfig } from "../src/config/load.js";
import { mergeConfig } from "../src/config/interpolate.js";
import { echoConfigSchema } from "../src/config/schema.js";
import { EchoRuntime } from "../src/kernel/runtime.js";

test("страница и чат ходят через HTTP, ключ не возвращается", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "echo-http-"));
  await fs.mkdir(path.join(home, "memory"), { recursive: true });
  const config = echoConfigSchema.parse(
    mergeConfig(defaultConfig(), {
      slots: { llm: ["mock"], memory: ["files"] },
      providers: {
        mock: { kind: "llm", preset: "mock" },
        files: { kind: "memory", preset: "files" },
      },
      channels: { http: { host: "127.0.0.1", port: 43171 } },
    }),
  );
  await fs.writeFile(path.join(home, "echo.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  let loaded: LoadedConfig = await loadConfig(home);
  const runtime = new EchoRuntime(loaded.config, loaded.home, loaded.secrets);
  runtime.boot();
  const server = await startServer(runtime, 0, () => loaded, (next) => {
    loaded = next;
  });
  try {
    const page = await fetch(`${server.url}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Эхо/);
    const settings = await (await fetch(`${server.url}/api/settings`)).json();
    const encoded = JSON.stringify(settings);
    assert.equal(encoded.includes("apiKey"), false);
    const chat = await fetch(`${server.url}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "tool:calc 6*7", provider: "mock" }),
    });
    const reply = (await chat.json()) as { text: string; provider: { llm: string }; toolTrace: Array<{ name: string }> };
    assert.equal(chat.status, 200);
    assert.match(reply.text, /Готово: 42/);
    assert.equal(reply.provider.llm, "mock");
    assert.equal(reply.toolTrace[0]?.name, "calc");
  } finally {
    await server.close();
  }
});
