# ECHO

Универсальный runtime личного агента. Не ещё один чат и не конкурент чужому Джарвису: ядро со слотами, в которые вставляется любой мозг, голос, память, канал и руки.

Отвечает твоим голосом, если в слот `tts` поставлен клон (Zonos / XTTS / что угодно). Делает вещи через инструменты, MCP и внешний харнесс. Новую способность не нужно вшивать в ядро.

## Документы

- [Архитектура](docs/architecture.md) — слоты, фолбэк, как добавлять умение
- [Исследование ландшафта](docs/research.md) — кто уже собирал похожее и что можно переиспользовать из твоих репозиториев

## Запуск

Нужен Node.js 20+.

```bash
npm install
npm test
npx tsx src/cli.ts init --home ./.echo-home
npx tsx src/cli.ts doctor --home ./.echo-home
npx tsx src/cli.ts ask "который час" --home ./.echo-home
npx tsx src/cli.ts chat --home ./.echo-home
npx tsx src/cli.ts serve --home ./.echo-home
```

Панель слотов по умолчанию: [http://127.0.0.1:43171](http://127.0.0.1:43171).

Без ключей Эхо всё равно живой: в цепочке есть `mock-*`. Подставь настоящий мозг через переменные или конфиг `~/.echo/echo.config.json`.

```bash
export LLM_BASE_URL=https://api.deepseek.com/v1
export LLM_API_KEY=...
export LLM_MODEL=deepseek-chat
```

Тот же OpenAI-compatible вход ест Ollama, Deep.Assistant gateway, OpenRouter.

## Как добавить умение

1. Включить готовый слот в `slots.*` и описать его в `providers`.
2. Положить `*.echo-plugin.mjs` в `~/.echo/plugins` или `./plugins` — `register(api)` может добавить tool / llm / tts / channel.
3. Прописать MCP-сервер в `tools.mcp`.
4. Подключить внешние руки в `tools.harness` (OpenClaw, CLI, что угодно).

Голос владельца: файл `~/.echo/voices/owner.wav` и провайдер `zonos` (пакет `zonosjs`) или любой другой TTS в цепочке.
