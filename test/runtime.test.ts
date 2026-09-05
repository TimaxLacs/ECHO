import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultConfig } from "../src/config/defaults.js";
import { EchoRuntime } from "../src/kernel/runtime.js";

async function mockHome(): Promise<{ home: string; runtime: EchoRuntime }> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "echo-home-"));
  await fs.mkdir(path.join(home, "memory"), { recursive: true });
  await fs.mkdir(path.join(home, "workspace"), { recursive: true });
  const config = defaultConfig();
  config.slots.llm = ["mock-llm"];
  config.slots.stt = ["mock-stt"];
  config.slots.tts = ["mock-tts"];
  config.slots.memory = ["files"];
  config.channels.enabled = ["cli"];
  config.plugins = [];
  config.tools.files.root = path.join(home, "workspace");
  const runtime = new EchoRuntime(config, home);
  await runtime.boot();
  return { home, runtime };
}

test("runtime answers through mock llm and can call now", async () => {
  const { runtime } = await mockHome();
  const reply = await runtime.handle({ channel: "cli", speaker: "owner", text: "который час" });
  assert.match(reply.text, /T/);
  assert.equal(reply.provider.llm, "mock-llm");
  assert.equal(reply.toolTrace[0]?.name, "now");
  assert.equal(reply.toolTrace[0]?.ok, true);
});

test("runtime remembers a note via the memory tool", async () => {
  const { runtime, home } = await mockHome();
  await runtime.handle({ channel: "cli", speaker: "owner", text: "запомни что люблю кофе" });
  const files = await fs.readdir(path.join(home, "memory"));
  assert.ok(files.some((name) => name.endsWith(".md")));
});

test("doctor sees mock slots as alive", async () => {
  const { runtime } = await mockHome();
  const rows = await runtime.doctor();
  const llm = rows.find((row) => row.kind === "llm" && row.id === "mock-llm");
  assert.equal(llm?.ok, true);
});
