# Эхо

Личный агент, не продукт. С ним говорят, он помнит заметки, пользуется инструментами и отвечает тем мозгом, который включён: локальной моделью, Groq или OpenRouter.

Голос владельца — отдельный слот. Пока сервер клона (Zonos) не запущен, Эхо отвечает текстом.

## Запуск

Нужен Node.js 20+.

```bash
npm install
cp .env.example .env
npm test
npm run echo -- init --home ./.echo-home
npm run echo -- doctor --home ./.echo-home
npm run echo -- serve --home ./.echo-home
```

Страница: [http://127.0.0.1:43171](http://127.0.0.1:43171). Один вопрос из терминала:

```bash
npm run echo -- ask "который час" --provider groq --home ./.echo-home
```

`--provider` принимает `local`, `groq` или `openrouter`. Без флага Эхо идёт по цепочке из конфига.

Ключи лежат в `.env` или вводятся на странице и пишутся в дом данных (`echo.config.json` с правами `0600`). В репозиторий они не входят. `.env.example` — только пустые поля.

```bash
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

## Мозги

Один и тот же клиент OpenAI Chat Completions.

- Локально: Ollama или llama.cpp server. В настройках свои base URL и имя модели. Ключ не нужен и не отправляется. По умолчанию `http://127.0.0.1:11434/v1` и модель `qwen2.5:0.5b`.
- Groq: `https://api.groq.com/openai/v1`, модель по умолчанию `openai/gpt-oss-20b`.
- OpenRouter: `https://openrouter.ai/api/v1`, модель по умолчанию `openai/gpt-oss-20b`.

Ollama:

```bash
ollama serve
ollama pull qwen2.5:0.5b
```

Если веса скачать нельзя, тот же клиент можно направить на локальную заглушку:

```bash
npm run stub
```

Она слушает `http://127.0.0.1:11435/v1`, имя модели `echo-stub`. В настройках страницы поставь этот адрес в локальный base URL. Заглушка только повторяет протокол, это не нейросеть.

Живая проверка трёх путей (ключи читаются из `.env`, в вывод не печатаются):

```bash
npm run live
```

## Что умеет v1

Память файлами, инструменты `now`, `calc`, `memory_recall`, `memory_remember`, `files_*` в песочнице, `shell` из белого списка, `http_fetch` только в публичный интернет, `weather` через Open-Meteo. Каналы: терминал и локальная страница.

Не входит в эту версию: микрофон, отдельный процесс на каждый слот, Telegram, MCP, OpenClaw. Как устроено ядро — в [docs/architecture.md](docs/architecture.md). Поле вокруг Эха — в [docs/research.md](docs/research.md).
