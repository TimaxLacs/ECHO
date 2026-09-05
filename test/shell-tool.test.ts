import assert from "node:assert/strict";
import os from "node:os";
import { test } from "node:test";
import { EchoError } from "../src/kernel/types.js";
import type { ToolContext } from "../src/kernel/types.js";
import { shellTool } from "../src/tools/shell.js";

const ctx: ToolContext = {
  cwd: os.tmpdir(),
  home: os.tmpdir(),
  memory: {
    id: "files",
    kind: "memory",
    recall: async () => "",
    remember: async () => undefined,
    core: async () => "",
    probe: async () => true,
  },
};

test("shell tool runs an allowlisted command", async () => {
  const tool = shellTool(["uname"], 5000);
  const result = await tool.execute({ command: "uname" }, ctx);
  assert.equal(result.ok, true);
  assert.match(result.content, /\w+/);
});

test("shell tool denies commands outside the allow list", async () => {
  const tool = shellTool(["uname"], 5000);
  await assert.rejects(
    () => tool.execute({ command: "rm -rf /" }, ctx),
    (error: unknown) => error instanceof EchoError && error.code === "shell_denied",
  );
});
