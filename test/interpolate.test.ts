import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig } from "../src/config/defaults.js";
import { interpolate, mergeConfig } from "../src/config/interpolate.js";
import { echoConfigSchema } from "../src/config/schema.js";

test("подставляет env и запасное значение", () => {
  assert.equal(interpolate("${NAME:-эхо}", { NAME: "Тимакс" }), "Тимакс");
  assert.equal(interpolate("${MISSING:-эхо}", {}), "эхо");
  assert.equal(interpolate("${EMPTY:-эхо}", { EMPTY: "" }), "эхо");
});

test("конфиг по умолчанию проходит схему", () => {
  const merged = mergeConfig(defaultConfig(), { slots: { llm: ["mock"] } });
  const config = echoConfigSchema.parse(merged);
  assert.deepEqual(config.slots.llm, ["mock"]);
  assert.equal(config.providers.groq?.preset, "groq");
});
