import assert from "node:assert/strict";
import test from "node:test";
import { redact } from "../src/util/redact.js";

test("вырезает ключи по форме и по точному значению", () => {
  const secret = "gsk_unitfakekey1234567890";
  const text = `Authorization: Bearer ${secret} and sk-or-v1-abcdefghijklmnopqrstuvwxyz012345`;
  const cleaned = redact(text, [secret]);
  assert.equal(cleaned.includes(secret), false);
  assert.equal(cleaned.includes("sk-or-v1-"), false);
  assert.match(cleaned, /\[secret\]/);
});
