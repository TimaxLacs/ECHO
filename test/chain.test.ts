import assert from "node:assert/strict";
import { test } from "node:test";
import { firstWorking } from "../src/kernel/chain.js";
import { EchoError } from "../src/kernel/types.js";

test("firstWorking returns the first provider that succeeds", async () => {
  const used = await firstWorking(["dead", "live"], async (id) => {
    if (id === "dead") throw new Error("нет");
    return id.toUpperCase();
  });
  assert.equal(used.id, "live");
  assert.equal(used.value, "LIVE");
  assert.equal(used.attempts.length, 2);
});

test("firstWorking throws when the chain is empty of working providers", async () => {
  await assert.rejects(
    () => firstWorking(["a"], async () => {
      throw new Error("упал");
    }),
    (error: unknown) => error instanceof EchoError && error.code === "chain_exhausted",
  );
});
