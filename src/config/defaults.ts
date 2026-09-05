import type { EchoConfig } from "./schema.js";

export function defaultConfig(): EchoConfig {
  return {
    identity: {
      name: "Эхо",
      language: "ru",
      voice: { id: "owner", path: "~/.echo/voices/owner.wav" },
    },
    slots: {
      llm: ["ollama", "openai-compat", "mock-llm"],
      stt: ["openai-stt", "mock-stt"],
      tts: ["zonos", "openai-tts", "mock-tts"],
      memory: ["files"],
    },
    providers: {
      ollama: {
        kind: "llm",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen2.5:7b",
      },
      "openai-compat": {
        kind: "llm",
        baseUrl: "${LLM_BASE_URL}",
        apiKey: "${LLM_API_KEY}",
        model: "${LLM_MODEL}",
      },
      "mock-llm": { kind: "llm" },
      "openai-stt": {
        kind: "stt",
        baseUrl: "${STT_BASE_URL}",
        apiKey: "${STT_API_KEY}",
        model: "whisper-1",
      },
      "mock-stt": { kind: "stt" },
      zonos: {
        kind: "tts",
        baseUrl: "http://127.0.0.1:5050",
        language: "ru",
        voicePath: "~/.echo/voices/owner.wav",
      },
      "openai-tts": {
        kind: "tts",
        baseUrl: "${TTS_BASE_URL}",
        apiKey: "${TTS_API_KEY}",
        model: "tts-1",
      },
      "mock-tts": { kind: "tts" },
      files: { kind: "memory" },
    },
    tools: {
      enabled: ["now", "memory", "files", "http", "shell", "harness"],
      shell: { allow: ["ls", "pwd", "date", "uname"], timeoutMs: 15_000 },
      files: { root: "~/.echo/workspace" },
      http: { enabled: true, timeoutMs: 15_000 },
      mcp: [],
    },
    channels: {
      enabled: ["cli", "http"],
      http: { host: "127.0.0.1", port: 43171 },
      telegram: { token: "${TELEGRAM_BOT_TOKEN}" },
    },
    plugins: [],
    limits: { maxToolRounds: 6, historyTurns: 16 },
  };
}
