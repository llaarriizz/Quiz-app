# Recall

Turn a CSV of questions and answers into a study quiz. Recall imports your
notes, generates multiple-choice or written questions, scores each attempt, and
keeps a reviewable history — all stored locally.

Built with **Go**, **React**, **TypeScript**, **Tailwind CSS**, **Vite**, and
**SQLite**.

## Features

- Paste CSV text, upload a file, or load the built-in biology sample.
- Flexible CSV parsing: header aliases, comma/semicolon/tab delimiters, quoted
  fields, optional explanations and custom distractors.
- Three quiz modes:
  - **Multiple choice** — 4 options built from author-provided distractors and
    the other answers in the deck.
  - **Written** — type the answer; matching ignores case, punctuation, and
    extra spaces. Alternatives can be separated with `|`.
  - **Mixed** — alternates between both formats.
- Server-side scoring, so answer keys never reach the browser before submission.
- Results page with a question-by-question review and explanations.
- Attempt history with average/best scores.
- Keyboard-friendly quiz runner (`1`–`4` to choose, `Enter` to continue).
- Single Go binary can serve the built frontend and API in production.

## Project structure

```
.
├── backend/
│   ├── cmd/server/          # HTTP server entrypoint
│   └── internal/
│       ├── api/             # routes, handlers, middleware
│       ├── model/           # shared domain types
│       ├── quiz/            # CSV parsing + quiz generation
│       └── store/           # SQLite persistence
├── frontend/
│   └── src/
│       ├── components/      # layout, UI primitives, icons
│       ├── lib/             # API client, formatting, hooks, sample data
│       └── pages/           # home, import, deck, quiz, results, history
├── examples/biology.csv
├── Makefile
└── README.md
```

## Quick start

Build the frontend and the server, then run the binary:

```bash
make build
./bin/quiz -static ./frontend/dist -db ./quiz.db -addr :8080
```

Open <http://localhost:8080>. The database file is created automatically and is
ignored by Git.

## Requirements

- Go 1.27+
- Node.js 20.19+ (or 22.12+)

## Development

Install frontend dependencies once:

```bash
cd frontend
npm install
```

Run the API and the Vite dev server in two terminals:

```bash
# Terminal 1 — API on http://localhost:8080
make api

# Terminal 2 — frontend on http://localhost:5173
make web
```

Open <http://localhost:5173>. Vite proxies `/api` requests to the Go server.
The SQLite database defaults to `backend/quiz.db` and is created automatically.

## Production build

`make build` writes the frontend bundle to `frontend/dist` and the server
binary to `bin/quiz`. Run it with `-static` pointing at the bundle (see
[Quick start](#quick-start)).

Flags:

| Flag       | Default        | Description                                    |
| ---------- | -------------- | ---------------------------------------------- |
| `-addr`    | `:8080`        | HTTP listen address                            |
| `-db`      | `quiz.db`      | SQLite database path                           |
| `-static`  | _(empty)_      | Directory with the built frontend (SPA fallback) |

## CSV format

The simplest possible input:

```csv
question,answer
Capital of Japan?,Tokyo
```

A header row is optional. Without one, the first two columns are read as
question and answer, and an optional third column as an explanation.

More complete example:

```csv
question,answer,distractor1,distractor2,explanation
Which planet is known as the Red Planet?,Mars,Venus,Jupiter,Iron oxide gives Mars its colour.
```

Supported header names:

| Meaning     | Accepted names                                                       |
| ----------- | -------------------------------------------------------------------- |
| Question    | `question`, `q`, `prompt`, `term`, `front`, `word`, `concept`, `key`  |
| Answer      | `answer`, `a`, `definition`, `back`, `meaning`, `translation`, `value`, `solution` |
| Explanation | `explanation`, `note`, `hint`, `context`, `rationale`, `why`          |
| Distractor  | `distractor`, `distractors`, `wrong`, `option`, `choice`, plus numbered variants like `distractor1` |

Notes:

- Commas, semicolons, and tabs are auto-detected as delimiters.
- Multiple distractors can be placed in one column separated by `|` or `;`.
- If a multiple-choice question has fewer than three custom distractors, the
  remaining options are filled with answers from other cards.
- Multiple-choice requires at least two distinct answers (or custom
  distractors); single-card decks can still use written mode.
- Limits: 2 MB per request, 2,000 cards per deck.

## API

All responses are JSON. Errors use `{ "error": "message" }`.

| Method   | Path                          | Description                                  |
| -------- | ----------------------------- | -------------------------------------------- |
| `GET`    | `/api/health`                 | Health check                                 |
| `GET`    | `/api/decks`                  | List decks                                   |
| `POST`   | `/api/decks`                  | Import a deck (`{name, csv}`)                |
| `GET`    | `/api/decks/{id}`             | Deck with cards                              |
| `DELETE` | `/api/decks/{id}`             | Delete deck, quizzes, and attempts           |
| `POST`   | `/api/decks/{id}/quizzes`     | Generate quiz (`{mode, count}`)              |
| `GET`    | `/api/quizzes/{id}`           | Public quiz (no answer key)                  |
| `POST`   | `/api/quizzes/{id}/submit`    | Submit answers (`{answers, durationMs}`)     |
| `GET`    | `/api/attempts/{id}`          | Attempt with per-question review             |
| `GET`    | `/api/history?limit=20`       | Recent attempts                              |

Example:

```bash
curl -X POST http://localhost:8080/api/decks \
  -H 'Content-Type: application/json' \
  -d '{"name":"Capitals","csv":"question,answer\nJapan?,Tokyo\nFrance?,Paris\n"}'
```

## Tests

```bash
make test
```

- Go: CSV parsing, quiz generation, answer matching, and full API flows
  (import → generate → submit → review → history) using a temporary SQLite
  database.
- Frontend: formatting and scoring helpers with Vitest.

To smoke-test a running server manually:

```bash
# Import a deck
curl -X POST http://localhost:8080/api/decks \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke test","csv":"question,answer\nCapital of Japan?,Tokyo\n"}'

# Generate a quiz (use the deck id from the response)
curl -X POST http://localhost:8080/api/decks/<deck-id>/quizzes \
  -H 'Content-Type: application/json' \
  -d '{"mode":"written","count":1}'

# Submit an answer (use the quiz id and question id from the response)
curl -X POST http://localhost:8080/api/quizzes/<quiz-id>/submit \
  -H 'Content-Type: application/json' \
  -d '{"answers":{"q1":"Tokyo"},"durationMs":12000}'

# Review history
curl http://localhost:8080/api/history?limit=5
```

The health check, the built SPA, and its client-side routes are also available:

```bash
curl http://localhost:8080/api/health   # {"status":"ok"}
curl -I http://localhost:8080/          # 200 text/html
curl -I http://localhost:8080/history   # 200 text/html (SPA fallback)
```

## Design notes

- SQLite uses the pure-Go `modernc.org/sqlite` driver, so no CGO is required.
- Quizzes persist server-side, which keeps the answer key private and allows a
  results page to survive a refresh.
- Correct answer IDs are assigned after option shuffling; written answers are
  compared using a forgiving normalized match.
- The app has no authentication. It is intended to run locally or behind your
  own access control.
