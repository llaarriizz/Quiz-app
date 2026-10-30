package model

import "time"

// Quiz modes.
const (
	ModeMultipleChoice = "multiple_choice"
	ModeWritten        = "written"
	ModeMixed          = "mixed"
)

// Question kinds.
const (
	KindMultipleChoice = "multiple_choice"
	KindWritten        = "written"
)

// Card is a single study item imported from CSV.
type Card struct {
	ID          string   `json:"id,omitempty"`
	Question    string   `json:"question"`
	Answer      string   `json:"answer"`
	Explanation string   `json:"explanation,omitempty"`
	Distractors []string `json:"distractors,omitempty"`
}

// Deck is a named collection of cards.
type Deck struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CardCount int       `json:"cardCount"`
	CreatedAt time.Time `json:"createdAt"`
}

// Option is one choice in a multiple-choice question.
type Option struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

// Question is the public, answer-free shape sent to the client.
type Question struct {
	ID      string   `json:"id"`
	Prompt  string   `json:"prompt"`
	Kind    string   `json:"kind"`
	Options []Option `json:"options,omitempty"`
}

// Quiz is generated from a deck. Only public questions are exposed.
type Quiz struct {
	ID        string     `json:"id"`
	DeckID    string     `json:"deckId"`
	DeckName  string     `json:"deckName"`
	Mode      string     `json:"mode"`
	CreatedAt time.Time  `json:"createdAt"`
	Questions []Question `json:"questions"`
}

// StoredQuestion is the server-side question including answers.
type StoredQuestion struct {
	Question
	CorrectOptionID string `json:"correctOptionId,omitempty"`
	CorrectAnswer   string `json:"correctAnswer"`
	Explanation     string `json:"explanation,omitempty"`
}

// StoredQuiz is a quiz as persisted, including answer keys.
type StoredQuiz struct {
	Quiz
	Questions []StoredQuestion `json:"questions"`
}

// Result is the review of a single answered question.
type Result struct {
	QuestionID     string   `json:"questionId"`
	Prompt         string   `json:"prompt"`
	Kind           string   `json:"kind"`
	Options        []Option `json:"options,omitempty"`
	YourAnswer     string   `json:"yourAnswer"`
	YourAnswerText string   `json:"yourAnswerText"`
	CorrectAnswer  string   `json:"correctAnswer"`
	CorrectOption  string   `json:"correctOptionId,omitempty"`
	Explanation    string   `json:"explanation,omitempty"`
	Correct        bool     `json:"correct"`
}

// Attempt is a completed quiz, used for history and the results page.
type Attempt struct {
	ID         string    `json:"id"`
	QuizID     string    `json:"quizId"`
	DeckID     string    `json:"deckId"`
	DeckName   string    `json:"deckName"`
	Mode       string    `json:"mode"`
	Score      int       `json:"score"`
	Total      int       `json:"total"`
	DurationMs int       `json:"durationMs"`
	CreatedAt  time.Time `json:"createdAt"`
	Results    []Result  `json:"results,omitempty"`
}
