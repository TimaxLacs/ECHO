import assert from "node:assert/strict";
import test from "node:test";
import { evalMath } from "../src/tools/calc.js";

test("считает со скобками и отвергает код", () => {
  assert.equal(evalMath("(2+2)*3"), 12);
  assert.equal(evalMath("2+2*3"), 8);
  assert.throws(() => evalMath("process.exit()"));
  assert.throws(() => evalMath("2**3"));
});
