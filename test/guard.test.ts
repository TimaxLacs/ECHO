import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { assertPublicHttpUrl, isPrivateIp, resolveInside } from "../src/tools/guard.js";
import { EchoError } from "../src/kernel/types.js";

test("файл не выходит из песочницы", () => {
  const root = path.join(os.tmpdir(), "echo-sandbox");
  assert.equal(resolveInside(root, "notes/a.txt"), path.join(root, "notes", "a.txt"));
  assert.throws(() => resolveInside(root, "../etc/passwd"), EchoError);
  assert.throws(() => resolveInside(root, "/etc/passwd"), EchoError);
});

test("внутренние адреса закрыты", async () => {
  assert.equal(isPrivateIp("10.1.2.3"), true);
  assert.equal(isPrivateIp("8.8.8.8"), false);
  for (const url of [
    "http://127.0.0.1/",
    "http://169.254.169.254/",
    "http://localhost/x",
    "file:///etc/passwd",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.1.2.3]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[::]/",
    "http://[fe9b::1]/",
  ]) {
    await assert.rejects(() => assertPublicHttpUrl(url), EchoError);
  }
});
