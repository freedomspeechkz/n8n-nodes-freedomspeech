# n8n-nodes-freedomspeech

Нода сообщества n8n для API Freedom Speech: распознавание и синтез речи, перевод и определение языка
для казахского, русского и английского. Сайт сервиса: https://freedomspeech.kz

[English below](#english)

## Что умеет

| Операция | Вход | Выход |
|---|---|---|
| Transcribe | аудиофайл в бинарном поле (wav, mp3, ogg, flac, m4a, webm) | JSON: `text`, `language`, `segments`, при диаризации говорящие |
| Speak | текст, голос, модель | WAV 24 кГц в бинарном поле |
| Translate | текст, целевой язык (kk, ru, en) | JSON: `text`, `detectedSourceLanguage` |
| Detect Language | текст | JSON: `language` |
| Voices | ничего | по одному элементу на каждый голос |

## Установка

В n8n: `Settings > Community Nodes > Install`, имя пакета `n8n-nodes-freedomspeech`.

Вручную (self-hosted):

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-freedomspeech
```

После установки перезапустить n8n.

## Учётные данные

`Credentials > New > Freedom Speech API`. Поля:

- `API Key`: ключ из личного кабинета freedomspeech.kz. Передаётся в заголовке `X-API-Key`.
- `Base URL`: по умолчанию `https://freedomspeech.kz`, менять не нужно.

Кнопка `Test` отправляет короткий запрос определения языка и так проверяет ключ.

## Примеры

Распознать запись из Telegram или почты: `Trigger` с вложением -> `Freedom Speech` (Transcribe, Input Binary Field = `data`) -> дальше `json.text`.

Озвучить ответ: `Freedom Speech` (Speak, Text = `{{ $json.answer }}`, Voice = `tomiris`) -> `Telegram` (Send Audio, бинарное поле `data`).

Перевести, потом озвучить: `Freedom Speech` (Translate, Target = `kk`) -> `Freedom Speech` (Speak, Text = `{{ $json.text }}`).

## Ограничения

- Потоковые протоколы (WebSocket `/ws/asr`, `/ws/tts`) в ноде не используются, только HTTP.
- Клонирование и дизайн голоса в ноду не вынесены; для них есть Python и JavaScript SDK.
- Один запрос на элемент; длинные записи лучше делить заранее.
- Эмоции для модели `freedomspeech-flash` пока не подключены.

## Сборка из исходников

```bash
git clone <репозиторий> && cd n8n
npm install
npm run build      # tsc + копирование иконки в dist/
npm test           # сборка и тесты node:test без сети
```

Проверить в локальном n8n:

```bash
npm link
cd ~/.n8n/nodes && npm link n8n-nodes-freedomspeech
n8n start
```

Структура по шаблону n8n-nodes-starter: `credentials/FreedomSpeechApi.credentials.ts`,
`nodes/FreedomSpeech/FreedomSpeech.node.ts`, поле `n8n` в `package.json` указывает на собранные файлы в `dist/`.

## Лицензия

MIT, Freedom Speech.

---

## English

n8n community node for the Freedom Speech API: speech recognition, speech synthesis, translation and language detection
for Kazakh, Russian and English. Service site: https://freedomspeech.kz

### Operations

| Operation | Input | Output |
|---|---|---|
| Transcribe | audio file in a binary field (wav, mp3, ogg, flac, m4a, webm) | JSON: `text`, `language`, `segments`, speakers when diarization is on |
| Speak | text, voice, model | WAV 24 kHz in a binary field |
| Translate | text, target language (kk, ru, en) | JSON: `text`, `detectedSourceLanguage` |
| Detect Language | text | JSON: `language` |
| Voices | nothing | one item per voice |

### Install

In n8n: `Settings > Community Nodes > Install`, package name `n8n-nodes-freedomspeech`.

Manually (self-hosted):

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-freedomspeech
```

Restart n8n afterwards.

### Credentials

`Credentials > New > Freedom Speech API`:

- `API Key`: the key from your freedomspeech.kz dashboard, sent as the `X-API-Key` header.
- `Base URL`: defaults to `https://freedomspeech.kz`; no need to change it.

The `Test` button sends a short language detection request to check the key.

### Examples

Transcribe a voice message: attachment trigger -> `Freedom Speech` (Transcribe, Input Binary Field = `data`) -> use `json.text`.

Speak an answer: `Freedom Speech` (Speak, Text = `{{ $json.answer }}`, Voice = `tomiris`) -> `Telegram` (Send Audio, binary field `data`).

Translate then speak: `Freedom Speech` (Translate, Target = `kk`) -> `Freedom Speech` (Speak, Text = `{{ $json.text }}`).

### Limitations

- Streaming protocols (WebSocket `/ws/asr`, `/ws/tts`) are not used by the node; HTTP only.
- Voice cloning and voice design are not exposed; use the Python or JavaScript SDK for those.
- One request per item; split long recordings beforehand.
- Emotions for `freedomspeech-flash` are not wired yet.

### Build from source

```bash
npm install
npm run build      # tsc + copy the icon into dist/
npm test           # build and run node:test tests, no network
```

Try it in a local n8n:

```bash
npm link
cd ~/.n8n/nodes && npm link n8n-nodes-freedomspeech
n8n start
```

Layout follows n8n-nodes-starter: `credentials/FreedomSpeechApi.credentials.ts`,
`nodes/FreedomSpeech/FreedomSpeech.node.ts`, and the `n8n` field in `package.json` points at the built files in `dist/`.

### License

MIT, Freedom Speech.
