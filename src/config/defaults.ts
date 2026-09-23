import type { EchoConfig } from "./schema.js";

export function defaultConfig(): EchoConfig {
  return {
    identity: {
      name: "Эхо",
      language: "ru",
      voice: { id: "owner", path: "~/.echo/voices/owner.wav" },
    },
    slots: {
      llm: ["local", "groq", "openrouter"],
      stt: [],
      tts: [],
      memory: ["files"],
    },
    providers: {
      local: {
        kind: "llm",
        preset: "local",
        baseUrl: "${LOCAL_LLM_BASE_URL:-http://127.0.0.1:11434/v1}",
        model: "${LOCAL_LLM_MODEL:-qwen2.5:0.5b}",
      },
      groq: {
        kind: "llm",
        preset: "groq",
        baseUrl: "https://api.groq.com/openai/v1",
        model: "${GROQ_MODEL:-openai/gpt-oss-20b}",
        apiKey: "${GROQ_API_KEY}",
      },
      openrouter: {
        kind: "llm",
        preset: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "${OPENROUTER_MODEL:-openai/gpt-oss-20b}",
        apiKey: "${OPENROUTER_API_KEY}",
      },
      zonos: {
        kind: "tts",
        preset: "zonos",
        baseUrl: "http://127.0.0.1:5050",
        language: "ru",
        voicePath: "~/.echo/voices/owner.wav",
      },
      files: { kind: "memory", preset: "files" },
    },
    tools: {
      enabled: ["now", "calc", "memory", "files", "shell", "http", "weather"],
      shell: { allow: ["date", "pwd", "uname", "ls"], timeoutMs: 15_000 },
      files: { root: "~/.echo/workspace" },
      http: { enabled: true, timeoutMs: 15_000, maxBytes: 200_000 },
    },
    channels: { http: { host: "127.0.0.1", port: 43_171 } },
    limits: { maxToolRounds: 4, historyTurns: 16 },
  };
}
