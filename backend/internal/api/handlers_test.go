package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"quizapp/internal/model"
	"quizapp/internal/store"
)

const sampleCSV = `question,answer,explanation
What is the capital of Australia?,Canberra,Canberra has been the capital since 1913.
Which planet is known as the Red Planet?,Mars,Iron oxide gives Mars its colour.
What is H2O?,Water,Two hydrogen atoms and one oxygen atom.
Who wrote Hamlet?,William Shakespeare,Published around 1600.
`

func newTestServer(t *testing.T) (*httptest.Server, *store.Store) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	srv := httptest.NewServer(New(st, "").Handler())
	t.Cleanup(srv.Close)
	return srv, st
}

func doJSON(t *testing.T, method, url string, body any) (*http.Response, []byte) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	return resp, data
}

type deckResponse struct {
	Deck  model.Deck   `json:"deck"`
	Cards []model.Card `json:"cards"`
}

type quizResponse struct {
	Quiz model.Quiz `json:"quiz"`
}

type attemptResponse struct {
	Attempt model.Attempt `json:"attempt"`
}

func createSampleDeck(t *testing.T, baseURL string) deckResponse {
	t.Helper()
	resp, body := doJSON(t, http.MethodPost, baseURL+"/api/decks", map[string]string{
		"name": "  Geography  ",
		"csv":  sampleCSV,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create deck status = %d body = %s", resp.StatusCode, body)
	}
	var out deckResponse
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("decode deck: %v", err)
	}
	return out
}

func TestDeckQuizAttemptFlow(t *testing.T) {
	srv, _ := newTestServer(t)
	baseURL := srv.URL

	deck := createSampleDeck(t, baseURL)
	if deck.Deck.Name != "Geography" || deck.Deck.CardCount != 4 || len(deck.Cards) != 4 {
		t.Fatalf("unexpected deck: %+v", deck.Deck)
	}
	if deck.Cards[0].ID == "" {
		t.Error("card id is empty")
	}

	resp, body := doJSON(t, http.MethodGet, baseURL+"/api/decks", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list decks status = %d", resp.StatusCode)
	}
	var list struct {
		Decks []model.Deck `json:"decks"`
	}
	if err := json.Unmarshal(body, &list); err != nil || len(list.Decks) != 1 {
		t.Fatalf("list decks = %s (err %v)", body, err)
	}

	resp, body = doJSON(t, http.MethodPost, baseURL+"/api/decks/"+deck.Deck.ID+"/quizzes", map[string]any{
		"count": 4,
		"mode":  model.ModeMultipleChoice,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create quiz status = %d body = %s", resp.StatusCode, body)
	}
	if strings.Contains(string(body), "correctAnswer") || strings.Contains(string(body), "correctOption") {
		t.Fatalf("quiz response leaks answers: %s", body)
	}
	var quiz quizResponse
	if err := json.Unmarshal(body, &quiz); err != nil {
		t.Fatalf("decode quiz: %v", err)
	}
	if len(quiz.Quiz.Questions) != 4 {
		t.Fatalf("got %d questions", len(quiz.Quiz.Questions))
	}

	// Build the answer key from the source deck, then answer everything correctly.
	answerByPrompt := map[string]string{}
	for _, card := range deck.Cards {
		answerByPrompt[card.Question] = card.Answer
	}
	answers := map[string]string{}
	for _, q := range quiz.Quiz.Questions {
		want := answerByPrompt[q.Prompt]
		found := false
		for _, opt := range q.Options {
			if opt.Text == want {
				answers[q.ID] = opt.ID
				found = true
			}
		}
		if !found {
			t.Fatalf("correct answer %q missing from options %+v", want, q.Options)
		}
	}

	resp, body = doJSON(t, http.MethodPost, baseURL+"/api/quizzes/"+quiz.Quiz.ID+"/submit", map[string]any{
		"answers":    answers,
		"durationMs": 12345,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("submit status = %d body = %s", resp.StatusCode, body)
	}
	var attempt attemptResponse
	if err := json.Unmarshal(body, &attempt); err != nil {
		t.Fatalf("decode attempt: %v", err)
	}
	if attempt.Attempt.Score != 4 || attempt.Attempt.Total != 4 {
		t.Errorf("score = %d/%d, want 4/4", attempt.Attempt.Score, attempt.Attempt.Total)
	}
	if attempt.Attempt.DurationMs != 12345 || len(attempt.Attempt.Results) != 4 {
		t.Errorf("unexpected attempt: %+v", attempt.Attempt)
	}

	resp, body = doJSON(t, http.MethodGet, baseURL+"/api/attempts/"+attempt.Attempt.ID, nil)
	if resp.StatusCode != http.StatusOK || !strings.Contains(string(body), "Canberra") {
		t.Errorf("get attempt status = %d body = %s", resp.StatusCode, body)
	}

	resp, body = doJSON(t, http.MethodGet, baseURL+"/api/history", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("history status = %d", resp.StatusCode)
	}
	var history struct {
		Attempts []model.Attempt `json:"attempts"`
	}
	if err := json.Unmarshal(body, &history); err != nil || len(history.Attempts) != 1 {
		t.Fatalf("history = %s (err %v)", body, err)
	}
	if history.Attempts[0].Score != 4 || history.Attempts[0].DeckName != "Geography" {
		t.Errorf("history entry = %+v", history.Attempts[0])
	}
}

func TestWrittenModeAndReview(t *testing.T) {
	srv, _ := newTestServer(t)
	deck := createSampleDeck(t, srv.URL)

	resp, body := doJSON(t, http.MethodPost, srv.URL+"/api/decks/"+deck.Deck.ID+"/quizzes", map[string]any{
		"mode":  model.ModeWritten,
		"count": 2,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create quiz status = %d body = %s", resp.StatusCode, body)
	}
	var quiz quizResponse
	if err := json.Unmarshal(body, &quiz); err != nil {
		t.Fatalf("decode quiz: %v", err)
	}

	answers := map[string]string{}
	for _, q := range quiz.Quiz.Questions {
		if q.Kind != model.KindWritten {
			t.Fatalf("kind = %q", q.Kind)
		}
	}

	// Answer the first question loosely (case and punctuation differences) and
	// leave the second one blank.
	for _, card := range deck.Cards {
		if card.Question == quiz.Quiz.Questions[0].Prompt {
			answers[quiz.Quiz.Questions[0].ID] = "  " + strings.ToUpper(card.Answer) + ". "
		}
	}

	resp, body = doJSON(t, http.MethodPost, srv.URL+"/api/quizzes/"+quiz.Quiz.ID+"/submit", map[string]any{
		"answers": answers,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("submit status = %d body = %s", resp.StatusCode, body)
	}
	var attempt attemptResponse
	if err := json.Unmarshal(body, &attempt); err != nil {
		t.Fatalf("decode attempt: %v", err)
	}
	if attempt.Attempt.Score != 1 {
		t.Errorf("score = %d, want 1", attempt.Attempt.Score)
	}
	found := false
	for _, result := range attempt.Attempt.Results {
		if !result.Correct && result.YourAnswerText == "" && result.CorrectAnswer != "" {
			found = true
		}
	}
	if !found {
		t.Errorf("blank answer review missing: %+v", attempt.Attempt.Results)
	}
}

func TestValidationAndNotFound(t *testing.T) {
	srv, _ := newTestServer(t)

	for name, payload := range map[string]map[string]string{
		"empty csv":      {"name": "x", "csv": ""},
		"missing answer": {"name": "x", "csv": "question,answer\nQ,\n"},
		"one column csv": {"name": "x", "csv": "question\nQ\n"},
	} {
		resp, body := doJSON(t, http.MethodPost, srv.URL+"/api/decks", payload)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("%s: status = %d body = %s", name, resp.StatusCode, body)
		}
	}

	deck := createSampleDeck(t, srv.URL)

	resp, body := doJSON(t, http.MethodPost, srv.URL+"/api/decks/"+deck.Deck.ID+"/quizzes", map[string]any{
		"mode": "nonsense",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid mode status = %d body = %s", resp.StatusCode, body)
	}

	resp, body = doJSON(t, http.MethodPost, srv.URL+"/api/decks/"+deck.Deck.ID+"/quizzes", map[string]any{
		"mode": model.ModeMultipleChoice,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create quiz: %d %s", resp.StatusCode, body)
	}
	var quiz quizResponse
	json.Unmarshal(body, &quiz)

	resp, _ = doJSON(t, http.MethodPost, srv.URL+"/api/quizzes/"+quiz.Quiz.ID+"/submit", map[string]any{
		"answers": map[string]string{"nope": "a"},
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("unknown question status = %d", resp.StatusCode)
	}

	resp, _ = doJSON(t, http.MethodPost, srv.URL+"/api/quizzes/"+quiz.Quiz.ID+"/submit", map[string]any{
		"answers": map[string]string{quiz.Quiz.Questions[0].ID: "z"},
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid option status = %d", resp.StatusCode)
	}

	for _, path := range []string{"/api/decks/missing", "/api/quizzes/missing", "/api/attempts/missing"} {
		resp, _ := doJSON(t, http.MethodGet, srv.URL+path, nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("%s status = %d, want 404", path, resp.StatusCode)
		}
	}

	resp, _ = doJSON(t, http.MethodDelete, srv.URL+"/api/decks/"+deck.Deck.ID, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("delete status = %d", resp.StatusCode)
	}
	resp, _ = doJSON(t, http.MethodGet, srv.URL+"/api/decks/"+deck.Deck.ID, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("deleted deck status = %d", resp.StatusCode)
	}
}

func TestHealthAndSingleCardDeckCannotDoMultipleChoice(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, _ := doJSON(t, http.MethodGet, srv.URL+"/api/health", nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("health status = %d", resp.StatusCode)
	}

	resp, body := doJSON(t, http.MethodPost, srv.URL+"/api/decks", map[string]string{
		"name": "Single",
		"csv":  "question,answer\nOnly question,Only answer\n",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create deck status = %d body = %s", resp.StatusCode, body)
	}
	var deck deckResponse
	json.Unmarshal(body, &deck)

	resp, body = doJSON(t, http.MethodPost, srv.URL+"/api/decks/"+deck.Deck.ID+"/quizzes", map[string]any{
		"mode": model.ModeMultipleChoice,
	})
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("status = %d body = %s, want 422", resp.StatusCode, body)
	}

	resp, body = doJSON(t, http.MethodPost, srv.URL+"/api/decks/"+deck.Deck.ID+"/quizzes", map[string]any{
		"mode": model.ModeWritten,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("written quiz status = %d body = %s", resp.StatusCode, body)
	}
}
