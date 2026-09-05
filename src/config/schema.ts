import { z } from "zod";

const providerSchema = z
  .object({
    kind: z.enum(["llm", "stt", "tts", "memory"]),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    language: z.string().optional(),
    voicePath: z.string().optional(),
    command: z.string().optional(),
  })
  .passthrough();

const mcpServerSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
});

export const echoConfigSchema = z.object({
  identity: z.object({
    name: z.string().min(1).default("Эхо"),
    language: z.string().min(1).default("ru"),
    voice: z.object({
      id: z.string().default("owner"),
      path: z.string().optional(),
    }),
  }),
  slots: z.object({
    llm: z.array(z.string()).min(1),
    stt: z.array(z.string()).min(1),
    tts: z.array(z.string()).min(1),
    memory: z.array(z.string()).min(1),
  }),
  providers: z.record(providerSchema),
  tools: z.object({
    enabled: z.array(z.string()),
    shell: z.object({
      allow: z.array(z.string()).default([]),
      timeoutMs: z.number().int().positive().default(15_000),
    }),
    files: z.object({
      root: z.string(),
    }),
    http: z.object({
      enabled: z.boolean().default(true),
      timeoutMs: z.number().int().positive().default(15_000),
    }),
    mcp: z.array(mcpServerSchema).default([]),
    harness: z
      .object({
        name: z.string(),
        command: z.string(),
        args: z.array(z.string()).default([]),
      })
      .optional(),
  }),
  channels: z.object({
    enabled: z.array(z.string()).min(1),
    telegram: z
      .object({
        token: z.string().optional(),
      })
      .optional(),
    http: z
      .object({
        host: z.string().default("127.0.0.1"),
        port: z.number().int().positive().default(43171),
      })
      .optional(),
  }),
  plugins: z.array(z.string()).default([]),
  limits: z
    .object({
      maxToolRounds: z.number().int().positive().default(6),
      historyTurns: z.number().int().positive().default(16),
    })
    .default({}),
});

export type EchoConfig = z.infer<typeof echoConfigSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;
export type McpServerConfig = z.infer<typeof mcpServerSchema>;
