import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initHome } from "../src/boot/init-home.js";
import { loadConfig } from "../src/config/load.js";
import { applySettings, viewSettings } from "../src/config/settings.js";

test("сохранение модели не записывает ключ из окружения в файл", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "echo-settings-"));
  const previous = process.env.ECHO_HOME;
  const previousKey = process.env.GROQ_API_KEY;
  process.env.ECHO_HOME = home;
  process.env.GROQ_API_KEY = "gsk_unitfakekey1234567890";
  try {
    await initHome(home);
    const loaded = await loadConfig(home);
    assert.equal(viewSettings(loaded.config).groq.hasKey, true);
    const next = await applySettings(loaded, { groq: { model: "llama-test" } });
    const file = await fs.readFile(path.join(home, "echo.config.json"), "utf8");
    assert.match(file, /\$\{GROQ_API_KEY\}/);
    assert.equal(file.includes("gsk_"), false);
    assert.equal(next.config.providers.groq?.model, "llama-test");
    const view = JSON.stringify(viewSettings(next.config));
    assert.equal(view.includes("apiKey"), false);
    assert.equal(view.includes("gsk_"), false);
  } finally {
    if (previous === undefined) delete process.env.ECHO_HOME;
    else process.env.ECHO_HOME = previous;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});
