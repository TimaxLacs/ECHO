#!/usr/bin/env node
import { parseArgs } from "node:util";
import { initHome } from "./boot/init-home.js";
import { printReply } from "./channels/cli.js";
import { loadConfig } from "./config/load.js";
import { EchoRuntime } from "./kernel/runtime.js";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      home: { type: "string" },
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
    console.log(`Дом Эха: ${created.home}\nКонфиг: ${created.config}`);
    return;
  }

  const loaded = await loadConfig(values.home);
  const runtime = new EchoRuntime(loaded.config, loaded.home);
  await runtime.boot();

  if (command === "doctor" || command === "slots") {
    for (const row of await runtime.doctor()) {
      console.log(`${row.ok ? "ok " : "no "} ${row.kind.padEnd(8)} ${row.id.padEnd(18)} ${row.detail}`);
    }
    return;
  }
  if (command === "ask") {
    const text = positionals.slice(1).join(" ").trim();
    if (!text) throw new Error("echo-agent ask «текст»");
    printReply(await runtime.handle({ channel: "cli", speaker: "owner", text }));
    return;
  }
  if (command === "chat") {
    const channel = runtime.registry.channels.get("cli");
    if (!channel) throw new Error("Канал cli не зарегистрирован");
    await channel.start((turn) => runtime.handle(turn));
    return;
  }
  if (command === "serve") {
    await startChannels(runtime, ["http", "telegram"]);
    const port = loaded.config.channels.http?.port ?? 43171;
    const host = loaded.config.channels.http?.host ?? "127.0.0.1";
    console.log(`Эхо на http://${host}:${port}`);
    await hang();
    return;
  }
  printHelp();
}

async function startChannels(runtime: EchoRuntime, ids: string[]): Promise<void> {
  for (const id of ids) {
    const channel = runtime.registry.channels.get(id);
    if (!channel) continue;
    await channel.start((turn) => runtime.handle(turn));
  }
}

function hang(): Promise<void> {
  return new Promise(() => undefined);
}

function printHelp(): void {
  console.log(`echo-agent — универсальный runtime Эха

команды:
  init              создать ~/.echo (конфиг, память, пример плагина)
  doctor            кто из слотов жив
  ask «текст»       один вопрос
  chat              диалог в терминале
  serve             HTTP-панель и Telegram, если задан токен

флаги:
  --home <путь>     дом данных, иначе ECHO_HOME или ~/.echo
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
