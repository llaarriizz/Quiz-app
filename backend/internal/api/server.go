package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"quizapp/internal/store"
)

// Server exposes the quiz REST API and optionally serves the built frontend.
type Server struct {
	store     *store.Store
	staticDir string
}

func New(st *store.Store, staticDir string) *Server {
	return &Server{store: st, staticDir: staticDir}
}

// Handler returns the fully wired HTTP handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/decks", s.listDecks)
	mux.HandleFunc("POST /api/decks", s.createDeck)
	mux.HandleFunc("GET /api/decks/{deckID}", s.getDeck)
	mux.HandleFunc("DELETE /api/decks/{deckID}", s.deleteDeck)
	mux.HandleFunc("POST /api/decks/{deckID}/quizzes", s.createQuiz)

	mux.HandleFunc("GET /api/quizzes/{quizID}", s.getQuiz)
	mux.HandleFunc("POST /api/quizzes/{quizID}/submit", s.submitQuiz)

	mux.HandleFunc("GET /api/attempts/{attemptID}", s.getAttempt)
	mux.HandleFunc("GET /api/history", s.listHistory)

	mux.HandleFunc("/", s.serveFrontend)

	return withLogging(withCORS(mux))
}

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("write json: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if dec.More() {
		return errors.New("request body must contain a single JSON object")
	}
	return nil
}

func (s *Server) serveFrontend(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		writeError(w, http.StatusNotFound, "endpoint not found")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if s.staticDir == "" {
		writeJSON(w, http.StatusOK, map[string]string{
			"name": "Quiz API",
			"hint": "Frontend not built. Run the Vite dev server or build the frontend.",
		})
		return
	}

	clean := filepath.Clean("/" + r.URL.Path)
	file := filepath.Join(s.staticDir, clean)
	if info, err := os.Stat(file); err == nil && !info.IsDir() {
		http.ServeFile(w, r, file)
		return
	}
	index := filepath.Join(s.staticDir, "index.html")
	if _, err := os.Stat(index); err != nil {
		writeError(w, http.StatusNotFound, "frontend build not found")
		return
	}
	http.ServeFile(w, r, index)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Millisecond))
	})
}
