package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"quizapp/internal/model"
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("not found")

type Store struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS decks (
	id          TEXT PRIMARY KEY,
	name        TEXT NOT NULL,
	created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
	id           TEXT PRIMARY KEY,
	deck_id      TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
	position     INTEGER NOT NULL,
	question     TEXT NOT NULL,
	answer       TEXT NOT NULL,
	explanation  TEXT NOT NULL DEFAULT '',
	distractors  TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS cards_deck_position ON cards(deck_id, position);

CREATE TABLE IF NOT EXISTS quizzes (
	id          TEXT PRIMARY KEY,
	deck_id     TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
	mode        TEXT NOT NULL,
	questions   TEXT NOT NULL,
	created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quizzes_deck ON quizzes(deck_id);

CREATE TABLE IF NOT EXISTS attempts (
	id           TEXT PRIMARY KEY,
	quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
	deck_id      TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
	mode         TEXT NOT NULL,
	score        INTEGER NOT NULL,
	total        INTEGER NOT NULL,
	duration_ms  INTEGER NOT NULL DEFAULT 0,
	results      TEXT NOT NULL,
	created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_created ON attempts(created_at DESC);
`

// Open opens (and initialises) the SQLite database at path.
func Open(path string) (*Store, error) {
	if path != ":memory:" {
		if dir := filepath.Dir(path); dir != "" && dir != "." {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, fmt.Errorf("create database directory: %w", err)
			}
		}
	}

	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", path)
	if path == ":memory:" {
		dsn = "file::memory:?cache=shared&_pragma=foreign_keys(1)"
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// SQLite handles one writer at a time; a single connection keeps things simple.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("initialise schema: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

// CreateDeck stores a deck and all of its cards atomically.
func (s *Store) CreateDeck(deck model.Deck, cards []model.Card) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`INSERT INTO decks (id, name, created_at) VALUES (?, ?, ?)`,
		deck.ID, deck.Name, deck.CreatedAt.UTC().Format(time.RFC3339Nano),
	); err != nil {
		return err
	}

	stmt, err := tx.Prepare(
		`INSERT INTO cards (id, deck_id, position, question, answer, explanation, distractors) VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for i, card := range cards {
		distractors, err := json.Marshal(card.Distractors)
		if err != nil {
			return err
		}
		if card.Distractors == nil {
			distractors = []byte("[]")
		}
		if _, err := stmt.Exec(card.ID, deck.ID, i, card.Question, card.Answer, card.Explanation, string(distractors)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ListDecks returns decks newest first.
func (s *Store) ListDecks() ([]model.Deck, error) {
	rows, err := s.db.Query(`
		SELECT d.id, d.name, d.created_at, COUNT(c.id)
		FROM decks d
		LEFT JOIN cards c ON c.deck_id = d.id
		GROUP BY d.id
		ORDER BY d.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	decks := make([]model.Deck, 0)
	for rows.Next() {
		var deck model.Deck
		var created string
		if err := rows.Scan(&deck.ID, &deck.Name, &created, &deck.CardCount); err != nil {
			return nil, err
		}
		deck.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
		decks = append(decks, deck)
	}
	return decks, rows.Err()
}

// GetDeck returns a deck and its cards in import order.
func (s *Store) GetDeck(id string) (model.Deck, []model.Card, error) {
	var deck model.Deck
	var created string
	err := s.db.QueryRow(`
		SELECT d.id, d.name, d.created_at, COUNT(c.id)
		FROM decks d
		LEFT JOIN cards c ON c.deck_id = d.id
		WHERE d.id = ?
		GROUP BY d.id`, id).Scan(&deck.ID, &deck.Name, &created, &deck.CardCount)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Deck{}, nil, ErrNotFound
	}
	if err != nil {
		return model.Deck{}, nil, err
	}
	deck.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)

	rows, err := s.db.Query(
		`SELECT id, question, answer, explanation, distractors FROM cards WHERE deck_id = ? ORDER BY position`, id,
	)
	if err != nil {
		return model.Deck{}, nil, err
	}
	defer rows.Close()

	cards := make([]model.Card, 0, deck.CardCount)
	for rows.Next() {
		var card model.Card
		var distractors string
		if err := rows.Scan(&card.ID, &card.Question, &card.Answer, &card.Explanation, &distractors); err != nil {
			return model.Deck{}, nil, err
		}
		_ = json.Unmarshal([]byte(distractors), &card.Distractors)
		cards = append(cards, card)
	}
	return deck, cards, rows.Err()
}

// DeleteDeck removes a deck, its cards, quizzes and attempts.
func (s *Store) DeleteDeck(id string) error {
	result, err := s.db.Exec(`DELETE FROM decks WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// SaveQuiz persists a generated quiz and its answer key.
func (s *Store) SaveQuiz(quiz model.StoredQuiz) error {
	questions, err := json.Marshal(quiz.Questions)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(
		`INSERT INTO quizzes (id, deck_id, mode, questions, created_at) VALUES (?, ?, ?, ?, ?)`,
		quiz.ID, quiz.DeckID, quiz.Mode, string(questions), quiz.CreatedAt.UTC().Format(time.RFC3339Nano),
	)
	return err
}

// GetQuiz returns a persisted quiz with its answer key.
func (s *Store) GetQuiz(id string) (model.StoredQuiz, error) {
	var quiz model.StoredQuiz
	var created, questions string
	err := s.db.QueryRow(`
		SELECT q.id, q.deck_id, d.name, q.mode, q.questions, q.created_at
		FROM quizzes q JOIN decks d ON d.id = q.deck_id
		WHERE q.id = ?`, id).
		Scan(&quiz.ID, &quiz.DeckID, &quiz.DeckName, &quiz.Mode, &questions, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return model.StoredQuiz{}, ErrNotFound
	}
	if err != nil {
		return model.StoredQuiz{}, err
	}
	quiz.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	if err := json.Unmarshal([]byte(questions), &quiz.Questions); err != nil {
		return model.StoredQuiz{}, err
	}
	quiz.Quiz.Questions = make([]model.Question, len(quiz.Questions))
	for i, q := range quiz.Questions {
		quiz.Quiz.Questions[i] = q.Question
	}
	return quiz, nil
}

// SaveAttempt stores a completed attempt.
func (s *Store) SaveAttempt(attempt model.Attempt) error {
	results, err := json.Marshal(attempt.Results)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`
		INSERT INTO attempts (id, quiz_id, deck_id, mode, score, total, duration_ms, results, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		attempt.ID, attempt.QuizID, attempt.DeckID, attempt.Mode, attempt.Score, attempt.Total,
		attempt.DurationMs, string(results), attempt.CreatedAt.UTC().Format(time.RFC3339Nano),
	)
	return err
}

// ListAttempts returns recent attempts, newest first, without per-question results.
func (s *Store) ListAttempts(limit int) ([]model.Attempt, error) {
	rows, err := s.db.Query(`
		SELECT a.id, a.quiz_id, a.deck_id, d.name, a.mode, a.score, a.total, a.duration_ms, a.created_at
		FROM attempts a JOIN decks d ON d.id = a.deck_id
		ORDER BY a.created_at DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	attempts := make([]model.Attempt, 0)
	for rows.Next() {
		var a model.Attempt
		var created string
		if err := rows.Scan(&a.ID, &a.QuizID, &a.DeckID, &a.DeckName, &a.Mode, &a.Score, &a.Total, &a.DurationMs, &created); err != nil {
			return nil, err
		}
		a.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
		attempts = append(attempts, a)
	}
	return attempts, rows.Err()
}

// GetAttempt returns one attempt including the full question review.
func (s *Store) GetAttempt(id string) (model.Attempt, error) {
	var a model.Attempt
	var created, results string
	err := s.db.QueryRow(`
		SELECT a.id, a.quiz_id, a.deck_id, d.name, a.mode, a.score, a.total, a.duration_ms, a.results, a.created_at
		FROM attempts a JOIN decks d ON d.id = a.deck_id
		WHERE a.id = ?`, id).
		Scan(&a.ID, &a.QuizID, &a.DeckID, &a.DeckName, &a.Mode, &a.Score, &a.Total, &a.DurationMs, &results, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return model.Attempt{}, ErrNotFound
	}
	if err != nil {
		return model.Attempt{}, err
	}
	a.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	if err := json.Unmarshal([]byte(results), &a.Results); err != nil {
		return model.Attempt{}, err
	}
	return a, nil
}
