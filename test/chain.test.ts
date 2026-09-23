import assert from "node:assert/strict";
import test from "node:test";
import { firstWorking } from "../src/kernel/chain.js";
import { EchoError } from "../src/kernel/types.js";

test("цепочка берёт первый живой и помнит провалы", async () => {
  const used = await firstWorking(["a", "b"], async (id) => {
    if (id === "a") throw new Error("down");
    return "ok";
  });
  assert.equal(used.id, "b");
  assert.equal(used.value, "ok");
  assert.equal(used.attempts[0]?.ok, false);
  assert.equal(used.attempts[1]?.ok, true);
});

test("пустая цепочка — ошибка", async () => {
  await assert.rejects(() => firstWorking([], async () => "x"), (error: unknown) => {
    assert.ok(error instanceof EchoError);
    assert.equal(error.code, "chain_exhausted");
    return true;
  });
});
