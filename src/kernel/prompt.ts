import type { EchoConfig } from "../config/schema.js";

export function systemPrompt(config: EchoConfig, memory: string, toolNames: string[]): string {
  const remembered = memory.trim().slice(0, 6000);
  return [
    `Ты ${config.identity.name}, личный агент владельца. Говори по-русски, коротко, по делу, без канцелярита и без чужого персонажа.`,
    `Язык владельца: ${config.identity.language}.`,
    "Инструмент вызывай только если без него нельзя ответить: текущее время, погода, файлы, память, команда, страница в сети. На обычную реплику отвечай текстом и не вызывай инструменты.",
    "Ключи, токены и пароли не записывай в память и не повторяй вслух.",
    toolNames.length ? `Инструменты: ${toolNames.join(", ")}.` : "Инструментов нет.",
    remembered ? `Память:\n${remembered}` : "Долгой памяти пока нет.",
  ].join("\n\n");
}
