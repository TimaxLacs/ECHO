# Компоненты Эха: стек, смысл, опенсорс, начальные инструменты

Это обсуждение, не реализация. По каждому слоту: зачем, где кончается, что уже хорошо сделано открыто, что брать, что писать самим.

## Стек

Писать Эхо на **TypeScript / Node 22**. Это совпадает с тем, что у тебя уже живое: api-gateway, zonosjs, xtts-v2-js, Telegram, OpenClaw (форк), MCP.

Не писать на JS сами нейросети клонирования голоса. Zonos, XTTS, Chatterbox, CosyVoice — это Python (или ONNX) с GPU. Правильный стек такой:

```
всё оркестрирование, каналы, тулы, протокол, клиенты   →  TypeScript
тяжёлый вывод моделей (клон, иногда STT)               →  отдельный процесс, часто Python
лёгкий локальный звук (VAD, speaker id, Kokoro)        →  JS через ONNX (sherpa-onnx-node, kokoro-js)
```

Это ровно паттерн `npx zonosjs serve`: снаружи npm, внутри Python. Слот остаётся JS-процессом. Соседние слоты Python не видят.

Не брать Python как язык Эха (Pipecat целиком). Не пытаться «чистый JS клон голоса как у Zonos» — для русского это пока слабее и сырее. Kokoro на JS — быстрый запасной рот без клона, не замена.

Общие библиотеки стека, не догмы:

| Задача | Пакет |
|---|---|
| Схемы и валидация | zod |
| HTTP-клиент | встроенный `fetch` |
| LLM-клиент | `openai` npm (ест любой compatible) |
| MCP | официальный `@modelcontextprotocol/sdk` |
| Telegram | grammy |
| Браузер | `@playwright/mcp` или playwright |
| Локальный звук | `sherpa-onnx-node`, `kokoro-js` |
| Тесты | встроенный `node:test` |

---

## 1. Протокол (`echo-protocol`)

**Что это.** Словарь, на котором слоты разговаривают с runtime. Не агент и не модель. JSON-RPC + версия `echo.v1` + контекст хода (`speaker`, язык, ссылка на голос) + ссылки на файлы/аудио вместо сырых байт.

**Зачем отдельно.** Единственное общее. Поменял Zonos — протокол не трогаешь. Поменял смысл поля — это уже `v2`, и это единственный момент, когда соседи обязаны обновиться.

**Чего не делает.** Не знает DeepSeek, Telegram, wav.

**Опенсорс, у кого учиться (не копировать всё):**

| Проект | Язык | Зачем смотреть | Не брать как есть |
|---|---|---|---|
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | TS | Кадр `Content-Length`, рукопожатие, capabilities | MCP не про голос и не про LLM-complete |
| [OpenClaw gateway-protocol](https://docs.openclaw.ai/gateway/protocol) | TS | Отдельный пакет схем, semver протокола | Это протокол *их* шлюза, не наших слотов |
| [Wyoming](https://github.com/OHF/wyoming) | Python | Как голос режут на отдельные процессы | Другая экосистема (HA), не JS-native |
| LSP | — | Старый проверенный JSON-RPC по stdio | Слишком про редакторы |

**Решение.** Свой тонкий `echo.v1` (черновик схем уже в `protocol/`). Транспорт как у MCP. Методы слотов — свои. Tools снаружи могут быть MCP, но runtime видит `tools.list` / `tools.call`.

---

## 2. Runtime (`echo-runtime`)

**Что это.** Диспетчер одного хода: пришло обращение → уточнил кто говорит → вспомнил → спросил мозг → по кругу вызвал руки → ответил в тот же канал голосом/текстом. Держит цепочку разговора. Не содержит Zonos и не парсит Telegram.

**Зачем отдельно.** Единственное место, где виден весь граф. Слоты не вызывают друг друга.

**Чего не делает.** Фоллбэк моделей (это llm), клон (tts), «кто у микрофона» (identity).

**Опенсорс:**

| Проект | Язык | Качество | Вердикт |
|---|---|---|---|
| [OpenClaw](https://github.com/openclaw/openclaw) | TS | Самый зрелый personal gateway 2026 | Не ядро Эха. Харнесс рук и каналов |
| [LiveKit agents-js](https://github.com/livekit/agents-js) | TS | Боевой realtime-голос, WebRTC | Для звонка/комнаты, не для всей жизни |
| [PersonalJarvis](https://github.com/PersonalJarvis/PersonalJarvis) | Python | Чистые слои Router → харнесс | Идея нарезки, не стек |
| Pipecat | Python | Лучший голосовой конвейер | Не наш язык |

**Решение.** Писать runtime самим на TS, тонким. Не форкать OpenClaw в ядро. OpenClaw подключать как руки/каналы. LiveKit — позже, когда появится «говори с телефона как с звонком».

---

## 3. Identity (`echo-identity`)

**Что это.** Ответ на «кто говорит» и «чей рот на выходе». Профиль: имя, язык, путь к эталону голоса, отпечаток говорящего. Runtime один раз делает `resolve` и кладёт результат в `ctx`. Больше никто в identity не ходит.

**Зачем отдельно.** Комната с двумя людьми. Напоминание «выпей таблетки» без личности — чужое. Клон без проверки, что эталон — речь владельца — дыра.

**Чего не делает.** Не синтезирует и не думает.

**Опенсорс:**

| Проект | Язык | Качество | Вердикт |
|---|---|---|---|
| [sherpa-onnx-node](https://www.npmjs.com/package/sherpa-onnx-node) | JS addon | VAD (Silero) + speaker embedding + verify. Живой пакет, Apache | **Брать** как движок отпечатка |
| Jarvis Automation | mixed | Единственный self-hosted, где speaker id в центре продукта | Идея продукта, не библиотека |
| OpenClaw `USER.md` | файлы | Профиль человека текстом | Для фактов, не для голоса |

**Решение.** Слот на TS. Железо — sherpa. Профили — файлы (`owner.json` + `owner.wav`). Запись эталона с проверкой «это речь, не тишина».

---

## 4. LLM (`echo-llm`)

**Что это.** Кто думает. На входе сообщения и список инструментов, на выходе текст или вызовы тулов. Внутри — цепочка: локальная модель → твой шлюз / DeepSeek → запас. Runtime видит один мозг.

**Зачем отдельно.** Модель меняется раз в месяц. Протокол — нет.

**Чего не делает.** Сам не ходит в память и не исполняет тулы (это делает runtime → memory/tools).

**Опенсорс:**

| Проект | Язык | Качество | Вердикт |
|---|---|---|---|
| [deep-assistant/api-gateway](https://github.com/deep-assistant/api-gateway) | JS | У тебя в проде: фоллбэк 12–16, биллинг | **Первый мозг по умолчанию**, если шлюз жив |
| [Ollama](https://ollama.com) `/v1` | Go | Локальный OpenAI-compatible | Адаптер, не писать |
| [ReallyArtificial/freeport](https://github.com/ReallyArtificial/freeport) | TS | Шлюз: фоллбэк, кэш, бюджет, UI | Смотреть, если свой шлюз не хочется тащить |
| [8monkey-ai/hebo-gateway](https://github.com/8monkey-ai/hebo-gateway) | TS | Встраиваемый шлюз, много провайдеров | Альтернатива freeport |
| [llm-harness](https://github.com/brandonkorous/llm-harness) | TS | Тонкий роутер без фреймворка | Если шлюз кажется жирным |
| LiteLLM | Python | Де-факто зоопарк провайдеров | Не наш язык |
| Vercel AI SDK | TS | Удобные стримы | Тянет экосистему Vercel, не обязателен |

**Решение.** Слот-клиент на TS, протокол `llm.complete`. Сзади — твой api-gateway и/или Ollama через официальный пакет `openai`. Новый шлюз не писать, пока жив Deep.Assistant.

---

## 5. STT (`echo-stt`)

**Что это.** Звук → текст. Внутри: отрезать тишину (VAD), распознать, отдать строку. Язык приходит в `ctx`.

**Зачем отдельно.** Можно сменить Whisper на облако, не трогая рот и мозг.

**Опенсорс:**

| Проект | Язык | Качество | Вердикт |
|---|---|---|---|
| [whisper.cpp](https://github.com/ggerganov/whisper.cpp) + [whisper-cpp-node](https://www.npmjs.com/package/whisper-cpp-node) | C++ / JS | Быстрый локальный Whisper, GPU | **Основной локальный STT** |
| [sherpa-onnx-node](https://www.npmjs.com/package/sherpa-onnx-node) | JS | Стрим ASR + VAD в одномaddon | Если нужен стрим без Python |
| [Echogarden](https://github.com/echogarden-project/echogarden) | TS | Whisper ONNX + куча движков, без Python | GPL-3. Смотреть, лицензия жёсткая |
| transformers.js Whisper | JS | Браузер/CPU | Запас, для русского слабее large |
| Deepinfra / твой шлюз `whisper-large-v3-turbo` | HTTP | Уже тарифицировано у тебя | Облачный фоллбэк |
| faster-whisper | Python | Лучшее качество/скорость на GPU | Сидор, если cpp не тянет русский |

**Решение.** JS-слот. Цепочка: whisper-cpp-node (или sherpa) → облако шлюза. VAD — Silero через sherpa, не энергия микрофона как в InnerEcho.

---

## 6. TTS (`echo-tts`)

**Что это.** Текст → звук **голосом из `ctx.voice_ref`**. Клон — поведение по умолчанию, не спрятанная опция.

**Зачем отдельно.** Движки клона живут своей жизнью и часто на Python.

**Опенсорс:**

| Проект | Язык | Клон | Русский | Вердикт |
|---|---|---|---|---|
| [Zyphra/Zonos](https://github.com/Zyphra/Zonos) + твой [zonosjs](https://www.npmjs.com/package/zonosjs) | Py + JS | да | сильный | **Основной клон.** Обёртка уже твоя |
| [xtts-v2-js](https://github.com/TimaxLacs/xtts-v2-js) | Py + JS | да, 17 языков | средний | Запасной клон, модель стареет |
| [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox) + [chatterbox-tts-api](https://github.com/XenoHead/chatterbox-tts-api) | Py, OpenAI-API | да | средний | Второй серьёзный локальный клон, эмоция |
| [kokoro-js](https://www.npmjs.com/package/kokoro-js) | JS/ONNX | нет | слабый как «ты» | Быстрый рот без клона, чтобы слот всегда отвечал |
| [Echogarden](https://github.com/echogarden-project/echogarden) | TS | через движки | разный | GPL-3 |
| CosyVoice / Fish Speech | Py | да | сильный | Имеет смысл как ещё один адаптер, не как ядро |
| ElevenLabs API | облако | лучший вау | хороший | Опция, не зависимость |

**Решение.** JS-слот с цепочкой: Zonos (твой пакет) → XTTS → Kokoro без клона → облако. Python не протекает в runtime.

---

## 7. Memory (`echo-memory`)

**Что это.** Что Эхо помнит между днями. Ядро профиля, поиск, запись факта. Не «весь чат в промпт».

**Зачем отдельно.** Файлы сегодня, граф завтра — мозг не должен заметить.

**Опенсорс:**

| Проект | Язык | Качество | Вердикт |
|---|---|---|---|
| Файловый ярус OpenClaw (`USER.md`, `MEMORY.md`, дневник) | файлы | Понятно, git-friendly, без магии | **Первый слой, писать самим** (это 3 файла) |
| [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) + твой [lightrag-mcp](https://github.com/TimaxLacs/lightrag-mcp) | Py + JS | Граф+вектор, ссылки на источники | **Второй слой**, когда файлов мало |
| [mem0](https://github.com/mem0ai/mem0) + TS MCP-мосты | Py / cloud | Зрелый «факты о человеке» | Если LightRAG тяжело |
| [d8corp/lightrag-mcp](https://github.com/d8corp/lightrag-mcp) | TS | 26 тулов к LightRAG | Запас, если свой MCP тесен |

**Решение.** Слот на TS. Сначала файлы. LightRAG подключается тем же `recall`/`remember`, не новым методом.

---

## 8. Tools (`echo-tools`)

**Что это.** Руки. Runtime говорит `list` и `call`. Внутри — встроенные тулы + MCP + внешний харнесс. Слот не сочиняет ответ пользователю.

**Зачем отдельно.** Новый навык = новый тул или новый MCP, не новый Эхо.

**Опенсорс-каркас (не список тулов):**

| Проект | Язык | Вердикт |
|---|---|---|
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | TS | **Как подключать чужие руки** |
| OpenClaw skills + tools | TS | Готовый зоопарк (почта, браузер, cron). Подключать харнессом, не копипастить |
| [@playwright/mcp](https://github.com/microsoft/playwright-mcp) | TS | Браузер |
| Home Assistant REST / MCP | — | Дом, не писать свой |

### Начальные инструменты

Пишем сами на JS, без MCP. Короткие, предсказуемые, с явным риском.

**А. Всегда, без сети**

| Тул | Делает | Риск | Зачем в первом наборе |
|---|---|---|---|
| `now` | Дата, время, пояс машины | read | Якорь «когда» |
| `memory.recall` | Найти в памяти | read | Иначе мозг каждый раз пустой |
| `memory.remember` | Записать факт | write | «Запомни, что…» |
| `files.list` | Список в песочнице `~/.echo/workspace` | read | Смотреть свои файлы |
| `files.read` | Прочитать файл внутри песочницы | read | |
| `files.write` | Записать файл внутри песочницы | write | Заметки, черновики |
| `calc` | Арифметика / единицы (чистая функция) | read | Не гонять LLM на 2+2 |
| `timer` | Поставить / снять таймер на машине Эха | write | Джарвис без таймера — игрушка |

**Б. Машина, под замком**

| Тул | Делает | Риск | Ограничение |
|---|---|---|---|
| `shell` | Команда из белого списка | exec | Только префиксы из конфига. Нет `rm -rf` |
| `app.open` | Открыть приложение/URL через ОС | exec | Белый список схем (`https`, `file` в workspace) |
| `clipboard.get` | Прочитать буфер | read | Только по явной просьбе |
| `clipboard.set` | Записать буфер | write | |
| `notify` | Системное уведомление | write | «Таймер», не спам |

**В. Сеть, но простые**

| Тул | Делает | Риск | Опенсорс сзади |
|---|---|---|---|
| `http.fetch` | GET/POST, текст до лимита | read | Сами + отсечь localhost/ссылки на метаданные облака |
| `web.search` | Поиск, сниппеты | read | [SearXNG](https://docs.searxng.org/) локально, без ключа |
| `web.fetch` | Страница → читаемый текст | read | readability / playwright fetch, не весь DOM |
| `weather` | Погода по месту | read | [Open-Meteo](https://open-meteo.com/), без ключа |

**Г. Сразу через чужой MCP, не писать**

| Тул (как его видит мозг) | Сзади | Зачем не писать |
|---|---|---|
| `browser.*` | `@playwright/mcp` | Клик, форма, вкладка — большой проект |
| `ha.*` | Home Assistant MCP/REST | Дом уже сделан |
| `harness.run` | OpenClaw / любой CLI | Почта, календарь, cron, гитхаб — их зоопарк |

**Д. Не в первый набор** (есть, но после живой петли)

Календарь и почта нативно, Spotify, скриншот рабочего стола, computer-use, платежи, «напиши во все соцсети». Это либо OpenClaw, либо отдельный разговор.

Итого первый набор, который Эхо *умеет сам*:  
`now`, `memory.recall`, `memory.remember`, `files.*`, `calc`, `timer`, `shell`, `app.open`, `clipboard.*`, `notify`, `http.fetch`, `web.search`, `web.fetch`, `weather`.  
Плюс разъёмы: `browser`, `ha`, `harness`.

---

## 9. Channel (`echo-channel`)

**Что это.** Откуда пришло и куда ответить. Единственный слот, который сам толкает runtime (`turn`) и принимает `deliver`. Не вызывает TTS: звук уже в ответе или его сделает runtime.

**Зачем отдельно.** Telegram сегодня, микрофон завтра — мозг не знают.

**Опенсорс:**

| Проект | Язык | Качество | Вердикт |
|---|---|---|---|
| [grammy](https://grammy.dev) | TS | Нормальный Telegram | **Первый внешний канал** |
| [deep-assistant/telegram-bot](https://github.com/deep-assistant/telegram-bot) | Py/JS | Боевые войсы, группы, Stars | Не копировать бота. Взять поведение: отвечать на обращение в группе |
| OpenClaw channels | TS | WhatsApp, Discord, Signal, iMessage… | Не писать 20 каналов. Либо харнесс, либо позже по одному |
| LiveKit | Go/TS | Звонок, комната | Позже |
| stdio CLI | сами | Нулевая зависимость | Первый канал для отладки |

**Решение.** JS-слот. Сначала CLI + Telegram (grammy). Микрофон комнаты — отдельный адаптер, когда STT/VAD живые. Мессенджеры пачкой — через OpenClaw, не своими велосипедами.

---

## 10. Blobs (не отдельная репа на старте)

Ссылки на аудио и файлы (`blob:…`, `file:…`). Иначе каждый слот таскает wav в JSON. На старте это папка `~/.echo/blobs` внутри runtime. Выносить, когда появится удалённый TTS на другой машине.

---

## Сводка «что брать, что писать»

| Компонент | Пишем сами | Берём | У тебя уже есть |
|---|---|---|---|
| Протокол | тонкий `echo.v1` | приёмы MCP / OpenClaw protocol | черновик схем |
| Runtime | да, тонкий TS | идеи слоёв PersonalJarvis | набросок в `src/` — не фундамент |
| Identity | да, профили | sherpa-onnx-node | нет |
| LLM | тонкий клиент | openai npm, Ollama | api-gateway |
| STT | тонкий слот | whisper-cpp-node / sherpa | whisper в шлюзе |
| TTS | тонкий слот | Zonos, XTTS, Kokoro | zonosjs, xtts-v2-js |
| Memory | файловый слой | LightRAG как второй | lightrag-mcp |
| Tools | начальный список выше | MCP SDK, Playwright, HA, OpenClaw | tg-runner, шлюз |
| Channel | CLI + склейка | grammy, потом OpenClaw | telegram-bot |

## Порядок, если согласен со списком

Не писать снова монолит. Обсудить по одному: стек (этот текст) → протокол/runtime → identity+tts (фишка голоса) → llm+memory+тулы ядра → telegram.

Следующий разговор логично начать с **identity + tts**: без «это ты» Эхо не Эхо. Или с **llm + tools ядра**, если хочешь сначала текстового Джарвиса.
