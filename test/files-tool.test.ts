import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EchoRuntime } from "../src/kernel/runtime.js";
import { runTool } from "../src/tools/register.js";
import { echoConfigSchema } from "../src/config/schema.js";
import { defaultConfig } from "../src/config/defaults.js";
import { mergeConfig } from "../src/config/interpolate.js";

test("файлы живут в песочнице, shell только из списка", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "echo-files-"));
  const root = path.join(home, "workspace");
  await fs.mkdir(root);
  const config = echoConfigSchema.parse(
    mergeConfig(defaultConfig(), {
      slots: { llm: ["mock"], memory: ["files"] },
      providers: { mock: { kind: "llm", preset: "mock" }, files: { kind: "memory", preset: "files" } },
      tools: { files: { root } },
    }),
  );
  const runtime = new EchoRuntime(config, home, []);
  runtime.boot();
  const write = runtime.registry.tools.get("files_write");
  const read = runtime.registry.tools.get("files_read");
  const shell = runtime.registry.tools.get("shell");
  assert.ok(write && read && shell);
  const ctx = { home, memory: runtime.registry.memory.get("files")! };
  const saved = await write.execute({ path: "note.txt", content: "привет" }, ctx);
  assert.equal(saved.ok, true);
  const loaded = await read.execute({ path: "note.txt" }, ctx);
  assert.equal(loaded.content, "привет");
  const escaped = await runTool(runtime.registry, "files_read", { path: "../echo.config.json" }, ctx, []);
  assert.equal(escaped.ok, false);
  const listed = await shell.execute({ command: "pwd" }, ctx);
  assert.equal(listed.ok, true);
  assert.equal(listed.content.includes(root), true);
  const blocked = await shell.execute({ command: "rm -rf /" }, ctx);
  assert.equal(blocked.ok, false);
  const piped = await shell.execute({ command: "pwd; uname" }, ctx);
  assert.equal(piped.ok, false);
});
