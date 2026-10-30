package api

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"quizapp/internal/model"
	"quizapp/internal/quiz"
	"quizapp/internal/store"
)

const (
	maxDeckName        = 80
	maxCardsPerDeck    = 2000
	maxQuestionLength  = 2000
	maxAnswerLength    = 3000
	maxExplanation     = 4000
	maxAttemptDuration = 6 * 60 * 60 * 1000 // six hours in ms
)

func newID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("generate id: %v", err))
	}
	return hex.EncodeToString(b)
}

func (s *Server) listDecks(w http.ResponseWriter, r *http.Request) {
	decks, err := s.store.ListDecks()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load decks")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"decks": decks})
}

type createDeckRequest struct {
	Name string `json:"name"`
	CSV  string `json:"csv"`
}

func (s *Server) createDeck(w http.ResponseWriter, r *http.Request) {
	var req createDeckRequest
	if err := readJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Untitled deck"
	}
	if utf8.RuneCountInString(name) > maxDeckName {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("deck name must be at most %d characters", maxDeckName))
		return
	}

	cards, err := quiz.ParseCSV(req.CSV)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(cards) > maxCardsPerDeck {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("deck has too many cards (max %d)", maxCardsPerDeck))
		return
	}
	for i, card := range cards {
		if utf8.RuneCountInString(card.Question) > maxQuestionLength {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("row %d: question is too long", i+1))
			return
		}
		if utf8.RuneCountInString(card.Answer) > maxAnswerLength {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("row %d: answer is too long", i+1))
			return
		}
		if utf8.RuneCountInString(card.Explanation) > maxExplanation {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("row %d: explanation is too long", i+1))
			return
		}
		cards[i].ID = newID()
	}

	deck := model.Deck{
		ID:        newID(),
		Name:      name,
		CardCount: len(cards),
		CreatedAt: time.Now().UTC(),
	}
	if err := s.store.CreateDeck(deck, cards); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save deck")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"deck": deck, "cards": cards})
}

func (s *Server) getDeck(w http.ResponseWriter, r *http.Request) {
	deck, cards, err := s.store.GetDeck(r.PathValue("deckID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "deck not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load deck")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deck": deck, "cards": cards})
}

func (s *Server) deleteDeck(w http.ResponseWriter, r *http.Request) {
	err := s.store.DeleteDeck(r.PathValue("deckID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "deck not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete deck")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type createQuizRequest struct {
	Count int    `json:"count"`
	Mode  string `json:"mode"`
}

func (s *Server) createQuiz(w http.ResponseWriter, r *http.Request) {
	deckID := r.PathValue("deckID")
	deck, cards, err := s.store.GetDeck(deckID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "deck not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load deck")
		return
	}

	var req createQuizRequest
	if err := readJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	if req.Mode == "" {
		req.Mode = model.ModeMultipleChoice
	}

	questions, err := quiz.GenerateQuestions(cards, req.Mode, req.Count, quiz.NewRand())
	if errors.Is(err, quiz.ErrNotEnoughChoices) {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	stored := model.StoredQuiz{
		Quiz: model.Quiz{
			ID:        newID(),
			DeckID:    deck.ID,
			DeckName:  deck.Name,
			Mode:      req.Mode,
			CreatedAt: time.Now().UTC(),
			Questions: make([]model.Question, len(questions)),
		},
		Questions: questions,
	}
	for i, q := range questions {
		stored.Quiz.Questions[i] = q.Question
	}
	if err := s.store.SaveQuiz(stored); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save quiz")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"quiz": stored.Quiz})
}

func (s *Server) getQuiz(w http.ResponseWriter, r *http.Request) {
	stored, err := s.store.GetQuiz(r.PathValue("quizID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "quiz not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quiz")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"quiz": stored.Quiz})
}

type submitRequest struct {
	Answers    map[string]string `json:"answers"`
	DurationMs int               `json:"durationMs"`
}

func (s *Server) submitQuiz(w http.ResponseWriter, r *http.Request) {
	stored, err := s.store.GetQuiz(r.PathValue("quizID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "quiz not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load quiz")
		return
	}

	var req submitRequest
	if err := readJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	if req.DurationMs < 0 {
		req.DurationMs = 0
	}
	if req.DurationMs > maxAttemptDuration {
		req.DurationMs = maxAttemptDuration
	}

	byID := make(map[string]model.StoredQuestion, len(stored.Questions))
	for _, q := range stored.Questions {
		byID[q.ID] = q
	}
	for id := range req.Answers {
		if _, ok := byID[id]; !ok {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("unknown question id %q", id))
			return
		}
	}
	for _, q := range stored.Questions {
		answer := strings.TrimSpace(req.Answers[q.ID])
		if q.Kind == model.KindMultipleChoice && answer != "" && !hasOption(q.Options, answer) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid option %q for question %s", answer, q.ID))
			return
		}
	}

	results := make([]model.Result, 0, len(stored.Questions))
	score := 0
	for _, q := range stored.Questions {
		answer := strings.TrimSpace(req.Answers[q.ID])
		result := model.Result{
			QuestionID:    q.ID,
			Prompt:        q.Prompt,
			Kind:          q.Kind,
			Options:       q.Options,
			YourAnswer:    answer,
			CorrectAnswer: q.CorrectAnswer,
			CorrectOption: q.CorrectOptionID,
			Explanation:   q.Explanation,
		}
		if q.Kind == model.KindMultipleChoice {
			if option, ok := findOption(q.Options, answer); ok {
				result.YourAnswerText = option.Text
				result.Correct = answer == q.CorrectOptionID
			}
		} else {
			result.YourAnswerText = answer
			result.Correct = quiz.CheckWritten(q.CorrectAnswer, answer)
		}
		if result.Correct {
			score++
		}
		results = append(results, result)
	}

	attempt := model.Attempt{
		ID:         newID(),
		QuizID:     stored.ID,
		DeckID:     stored.DeckID,
		DeckName:   stored.DeckName,
		Mode:       stored.Mode,
		Score:      score,
		Total:      len(stored.Questions),
		DurationMs: req.DurationMs,
		CreatedAt:  time.Now().UTC(),
		Results:    results,
	}
	if err := s.store.SaveAttempt(attempt); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save attempt")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"attempt": attempt})
}

func hasOption(options []model.Option, id string) bool {
	_, ok := findOption(options, id)
	return ok
}

func findOption(options []model.Option, id string) (model.Option, bool) {
	for _, option := range options {
		if option.ID == id {
			return option, true
		}
	}
	return model.Option{}, false
}

func (s *Server) getAttempt(w http.ResponseWriter, r *http.Request) {
	attempt, err := s.store.GetAttempt(r.PathValue("attemptID"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "attempt not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load attempt")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"attempt": attempt})
}

func (s *Server) listHistory(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			writeError(w, http.StatusBadRequest, "limit must be a positive number")
			return
		}
		limit = min(parsed, 100)
	}
	attempts, err := s.store.ListAttempts(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load history")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"attempts": attempts})
}
