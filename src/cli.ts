#!/usr/bin/env node
import { parseArgs } from "node:util";
import { initHome } from "./boot/init-home.js";
import { chatLoop, printReply } from "./channels/cli.js";
import { startServer } from "./channels/http.js";
import { loadConfig, type LoadedConfig } from "./config/load.js";
import { loadEnvFiles } from "./util/env.js";
import { EchoRuntime } from "./kernel/runtime.js";

async function main(): Promise<void> {
  loadEnvFiles();
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      home: { type: "string" },
      provider: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const command = positionals[0] ?? "help";
  if (values.help || command === "help") {
    printHelp();
    return;
  }
  if (command === "init") {
    const created = await initHome(values.home);
    console.log(`Дом Эха: ${created.home}`);
    console.log(`Конфиг: ${created.config}`);
    return;
  }

  let loaded = await loadConfig(values.home);
  const runtime = new EchoRuntime(loaded.config, loaded.home, loaded.secrets);
  runtime.boot();

  if (command === "doctor") {
    for (const row of await runtime.doctor()) {
      console.log(`${row.ok ? "ok" : "no"}  ${row.kind.padEnd(8)} ${row.id.padEnd(16)} ${row.detail}`);
    }
    return;
  }
  if (command === "ask") {
    const text = positionals.slice(1).join(" ").trim();
    if (!text) throw new Error("Нужен текст: echo ask «вопрос»");
    printReply(await runtime.handle({ channel: "cli", speaker: "owner", text, provider: values.provider }));
    return;
  }
  if (command === "chat") {
    await chatLoop(runtime, values.provider);
    return;
  }
  if (command === "serve") {
    const server = await startServer(runtime, loaded.config.channels.http.port, () => loaded, (next: LoadedConfig) => {
      loaded = next;
    });
    console.log(`Эхо на ${server.url}`);
    await new Promise(() => undefined);
    return;
  }
  printHelp();
}

function printHelp(): void {
  console.log(`echo — личный агент

команды:
  init                 дом данных: конфиг, память, песочница
  doctor               кто из мозгов отвечает
  ask «текст»          один ход
  chat                 диалог в терминале
  serve                локальная страница

флаги:
  --home <путь>        дом данных, иначе ECHO_HOME или ./.echo-home
  --provider <id>      local, groq или openrouter вместо цепочки
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
