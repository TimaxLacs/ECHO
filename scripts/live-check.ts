import { OpenAiCompatLlm } from "../src/providers/llm/openai-compat.js";
import type { ProviderConfig } from "../src/config/schema.js";
import { loadEnvFiles } from "../src/util/env.js";
import { redact } from "../src/util/redact.js";

loadEnvFiles();

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : ["groq", "openrouter", "local"];
const secrets = [process.env.GROQ_API_KEY, process.env.OPENROUTER_API_KEY].filter(
  (value): value is string => Boolean(value),
);

const presets: Record<string, ProviderConfig> = {
  local: {
    kind: "llm",
    preset: "local",
    baseUrl: process.env.LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1",
    model: process.env.LOCAL_LLM_MODEL || "qwen2.5:0.5b",
  },
  groq: {
    kind: "llm",
    preset: "groq",
    model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  },
  openrouter: {
    kind: "llm",
    preset: "openrouter",
    model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b",
  },
};

let failed = 0;
for (const name of names) {
  const config = presets[name];
  if (!config) {
    console.log(`${name}: неизвестный провайдер`);
    failed += 1;
    continue;
  }
  const llm = new OpenAiCompatLlm(name, config, fetch, secrets);
  try {
    const probe = await llm.probe();
    const output = await llm.complete({
      messages: [
        { role: "system", content: "Ответь одной короткой фразой по-русски." },
        { role: "user", content: "Скажи слово живо и больше ничего." },
      ],
      tools: [],
    });
    console.log(`${name}: probe=${probe} ${llm.describe()} text=${output.text.slice(0, 180)}`);
    if (!output.text.trim()) failed += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${name}: FAIL ${redact(message, secrets).slice(0, 300)}`);
  }
}

if (failed) process.exitCode = 1;
