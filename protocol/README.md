# echo.v1

Единственная общая зависимость слотов. Runtime и каждый слот зависят от этих схем. Слоты друг от друга — нет.

Версия в каждом запросе: `"protocol": "echo.v1"`. Несовместимое изменение = `echo.v2`, не тихий патч.

## Транспорт

Одно и то же тело:

1. JSON-RPC 2.0 поверх stdio, кадр `Content-Length` (как MCP/LSP).
2. `POST /rpc` с тем же JSON.

## Файлы

| Файл | Зачем |
|---|---|
| [envelope.schema.json](envelope.schema.json) | запрос/ответ, `ctx`, ошибки |
| [blob-ref.schema.json](blob-ref.schema.json) | ссылка на аудио/файл, не байты |
| [hello.schema.json](hello.schema.json) | рукопожатие и capabilities |
| [slots/](slots/) | методы каждого слота |

Семантика и нарезка репозиториев — в [docs/decoupling.md](../docs/decoupling.md).
