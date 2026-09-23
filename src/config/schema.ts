import { z } from "zod";

export const providerSchema = z.object({
  kind: z.enum(["llm", "stt", "tts", "memory"]),
  preset: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  language: z.string().optional(),
  voicePath: z.string().optional(),
});

export const echoConfigSchema = z.object({
  identity: z
    .object({
      name: z.string().min(1).default("Эхо"),
      language: z.string().min(1).default("ru"),
      voice: z
        .object({
          id: z.string().default("owner"),
          path: z.string().optional(),
        })
        .default({ id: "owner" }),
    })
    .default({}),
  slots: z
    .object({
      llm: z.array(z.string().min(1)).min(1).default(["local", "groq", "openrouter"]),
      stt: z.array(z.string()).default([]),
      tts: z.array(z.string()).default([]),
      memory: z.array(z.string().min(1)).min(1).default(["files"]),
    })
    .default({}),
  providers: z.record(providerSchema).default({}),
  tools: z
    .object({
      enabled: z
        .array(z.string())
        .default(["now", "calc", "memory", "files", "shell", "http", "weather"]),
      shell: z
        .object({
          allow: z.array(z.string()).default(["date", "pwd", "uname", "ls"]),
          timeoutMs: z.number().int().positive().default(15_000),
        })
        .default({}),
      files: z
        .object({
          root: z.string().default("~/.echo/workspace"),
        })
        .default({}),
      http: z
        .object({
          enabled: z.boolean().default(true),
          timeoutMs: z.number().int().positive().default(15_000),
          maxBytes: z.number().int().positive().default(200_000),
        })
        .default({}),
    })
    .default({}),
  channels: z
    .object({
      http: z
        .object({
          host: z.string().default("127.0.0.1"),
          port: z.number().int().positive().default(43_171),
        })
        .default({}),
    })
    .default({}),
  limits: z
    .object({
      maxToolRounds: z.number().int().positive().default(4),
      historyTurns: z.number().int().positive().default(16),
    })
    .default({}),
});

export type EchoConfig = z.infer<typeof echoConfigSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;
