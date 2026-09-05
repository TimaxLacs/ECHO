import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { filesTool } from "../src/tools/files.js";
import { EchoError } from "../src/kernel/types.js";
import type { ToolContext } from "../src/kernel/types.js";

function ctx(cwd: string): ToolContext {
  return {
    cwd,
    home: cwd,
    memory: {
      id: "files",
      kind: "memory",
      recall: async () => "",
      remember: async () => undefined,
      core: async () => "",
      probe: async () => true,
    },
  };
}

test("files tool writes and reads inside the workspace", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "echo-files-"));
  const tool = filesTool(root);
  await tool.execute({ action: "write", path: "note.txt", content: "привет" }, ctx(root));
  const read = await tool.execute({ action: "read", path: "note.txt" }, ctx(root));
  assert.equal(read.content, "привет");
});

test("files tool refuses path escape", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "echo-files-"));
  const tool = filesTool(root);
  await assert.rejects(
    () => tool.execute({ action: "read", path: "../secret" }, ctx(root)),
    (error: unknown) => error instanceof EchoError && error.code === "path_escape",
  );
});
