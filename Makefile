.PHONY: test build api web

# Run the Go API on :8080 with a local SQLite database.
api:
	cd backend && go run ./cmd/server

# Run the Vite dev server on :5173 (proxies /api to the Go server).
web:
	cd frontend && npm run dev

# Run all backend and frontend tests.
test:
	cd backend && go test ./...
	cd frontend && npm test

# Build the production bundle and a single Go binary in ./bin/quiz.
build:
	cd frontend && npm run build
	cd backend && go build -o ../bin/quiz ./cmd/server
