import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultConfig } from "../src/config/defaults.js";
import { mergeConfig } from "../src/config/interpolate.js";
import { echoConfigSchema } from "../src/config/schema.js";
import { EchoRuntime } from "../src/kernel/runtime.js";

test("ход с заглушкой вызывает now и отвечает текстом", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "echo-loop-"));
  const config = echoConfigSchema.parse(
    mergeConfig(defaultConfig(), {
      slots: { llm: ["mock"], memory: ["files"] },
      providers: { mock: { kind: "llm", preset: "mock" }, files: { kind: "memory", preset: "files" } },
    }),
  );
  const runtime = new EchoRuntime(config, home, []);
  runtime.boot();
  const reply = await runtime.handle({ channel: "test", text: "tool:now" });
  assert.match(reply.text, /Готово:/);
  assert.equal(reply.provider.llm, "mock");
  assert.equal(reply.toolTrace[0]?.name, "now");
  assert.match(reply.toolTrace[0]?.content ?? "", /2026/);
});
