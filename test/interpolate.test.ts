import assert from "node:assert/strict";
import { test } from "node:test";
import { interpolateDeep, interpolateEnv, missingEnvTokens } from "../src/config/interpolate.js";

test("interpolateEnv replaces known tokens and blanks unknown ones", () => {
  assert.equal(interpolateEnv("x${A}y", { A: "1" }), "x1y");
  assert.equal(interpolateEnv("${MISSING}", {}), "");
});

test("interpolateDeep walks objects", () => {
  const out = interpolateDeep({ url: "${HOST}/v1", nested: ["${HOST}"] }, { HOST: "http://x" });
  assert.deepEqual(out, { url: "http://x/v1", nested: ["http://x"] });
});

test("missingEnvTokens lists placeholders", () => {
  assert.deepEqual(missingEnvTokens("${LLM_API_KEY} ${X}"), ["LLM_API_KEY", "X"]);
});
