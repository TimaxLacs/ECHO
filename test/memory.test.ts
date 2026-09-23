import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileMemory } from "../src/providers/memory/files.js";

test("память пишет факт и вырезает секрет", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "echo-mem-"));
  const secret = "gsk_unitfakekey1234567890";
  const memory = new FileMemory("files", home, [secret]);
  await memory.remember(`ключ ${secret} не хранить`);
  const recalled = await memory.recall("ключ");
  assert.match(recalled, /\[secret\]/);
  assert.equal(recalled.includes(secret), false);
  const raw = await fs.readFile(path.join(home, "memory", "MEMORY.md"), "utf8");
  assert.equal(raw.includes(secret), false);
});
