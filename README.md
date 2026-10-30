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
├── .github/workflows/pages.yml  # GitHub Pages deployment
├── render.yaml                  # Render blueprint for the API
├── Makefile
└── README.md
```

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

```bash
make build
./bin/quiz -static ./frontend/dist -db ./quiz.db -addr :8080
```

Then open <http://localhost:8080>.

Flags:

| Flag       | Default        | Description                                    |
| ---------- | -------------- | ---------------------------------------------- |
| `-addr`    | `:8080`        | HTTP listen address                            |
| `-db`      | `quiz.db`      | SQLite database path                           |
| `-static`  | _(empty)_      | Directory with the built frontend (SPA fallback) |

## Deployment

The deployment split is:

- **Frontend** — the React build on GitHub Pages.
- **API** — the Go server on Render (or any host that can run a Go binary).

GitHub Pages only serves static files, so the API needs a separate host. The
frontend reads its API location from the `VITE_API_BASE_URL` build variable.

### 1. Deploy the API

The repository includes a Render blueprint in `render.yaml`.

1. Push this repository to GitHub.
2. In [Render](https://render.com), choose **New → Blueprint**, connect the
   repository, and apply the blueprint. This creates the `recall-api` web
   service.
3. Wait for the deploy, then copy the service URL, for example
   `https://recall-api.onrender.com`.
4. Check it: `curl https://recall-api.onrender.com/api/health`.

Render injects `$PORT`; the blueprint starts the server with
`./recall -addr :$PORT -db quiz.db`. The SQLite file lives on the instance's
ephemeral disk.

### 2. Configure the frontend

1. In the GitHub repository, open **Settings → Secrets and variables →
   Actions → Variables**.
2. Add a repository variable named `API_BASE_URL` with the Render service URL
   from step 1. No trailing slash is needed (one is stripped if present).
3. Make sure Pages is enabled: **Settings → Pages → Build and deployment →
   Source: GitHub Actions**. The workflow also attempts to enable it.

### 3. Deploy

Push to `main` (or run the **Deploy frontend to GitHub Pages** workflow
manually). The workflow:

- builds the frontend under the `/<repo>/` base path,
- injects `API_BASE_URL` as `VITE_API_BASE_URL`,
- copies `index.html` to `404.html` so client-side routes survive a refresh,
- publishes the `frontend/dist` artifact to Pages.

The site is served at `https://<user>.github.io/<repo>/`.

If `API_BASE_URL` is unset, the workflow still deploys the frontend but prints a
warning, and API calls show an explanatory error. Add the variable and re-run
the workflow.

### Deployment notes

- **Private repositories:** GitHub Pages from a private repository requires a
  paid GitHub plan (Pro, Team, or Enterprise). The published site itself is
  public even when the repository is private.
- **Render free tier:** the service spins down when idle and has no persistent
  disk, so decks and history are lost on restarts and deploys. Attach a paid
  disk mounted at `/var/data` and start with `-db /var/data/quiz.db` to persist
  SQLite data.
- **Cold starts:** the first request to a sleeping Render free instance can take
  several seconds.
- **No authentication:** anyone with the URL can import decks and read history.
  Do not store private study material on a public deployment.

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

## Design notes

- SQLite uses the pure-Go `modernc.org/sqlite` driver, so no CGO is required.
- Quizzes persist server-side, which keeps the answer key private and allows a
  results page to survive a refresh.
- Correct answer IDs are assigned after option shuffling; written answers are
  compared using a forgiving normalized match.
- The app has no authentication. It is intended to run locally or behind your
  own access control.
