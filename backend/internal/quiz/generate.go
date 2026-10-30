package quiz

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"os"
	"strings"
	"time"

	"quizapp/internal/model"
)

const (
	DefaultQuestionCount = 10
	MaxQuestionCount     = 100
	MaxOptions           = 4
)

// ErrNotEnoughChoices means the deck cannot support multiple-choice questions.
var ErrNotEnoughChoices = errors.New("not enough distinct answers for multiple choice questions; add distractor columns or use written mode")

// NewRand returns a non-deterministic source suitable for quiz generation.
func NewRand() *rand.Rand {
	return rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), uint64(os.Getpid())))
}

// GenerateQuestions builds a quiz from cards. It returns an error for an
// invalid mode or when multiple choice is impossible for the deck.
func GenerateQuestions(cards []model.Card, mode string, count int, rng *rand.Rand) ([]model.StoredQuestion, error) {
	if len(cards) == 0 {
		return nil, errors.New("deck has no cards")
	}
	switch mode {
	case model.ModeMultipleChoice, model.ModeWritten, model.ModeMixed:
	default:
		return nil, fmt.Errorf("invalid quiz mode %q", mode)
	}
	if count <= 0 {
		count = DefaultQuestionCount
	}
	if count > MaxQuestionCount {
		count = MaxQuestionCount
	}

	shuffled := make([]model.Card, len(cards))
	copy(shuffled, cards)
	rng.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})
	if count > len(shuffled) {
		count = len(shuffled)
	}
	selected := shuffled[:count]

	questions := make([]model.StoredQuestion, 0, count)
	for i, card := range selected {
		kind := model.KindWritten
		switch mode {
		case model.ModeMultipleChoice:
			kind = model.KindMultipleChoice
		case model.ModeMixed:
			// Alternate, but fall back to written when choices are scarce.
			if i%2 == 0 && canMakeChoices(card, cards) {
				kind = model.KindMultipleChoice
			}
		case model.ModeWritten:
			kind = model.KindWritten
		}

		q := model.StoredQuestion{
			Question: model.Question{
				ID:     fmt.Sprintf("q%d", i+1),
				Prompt: card.Question,
				Kind:   kind,
			},
			CorrectAnswer: card.Answer,
			Explanation:   card.Explanation,
		}

		if kind == model.KindMultipleChoice {
			if !canMakeChoices(card, cards) {
				return nil, ErrNotEnoughChoices
			}
			options, correctID := buildOptions(card, cards, rng)
			q.Options = options
			q.CorrectOptionID = correctID
		}
		questions = append(questions, q)
	}
	return questions, nil
}

func canMakeChoices(card model.Card, cards []model.Card) bool {
	seen := map[string]bool{strings.ToLower(strings.TrimSpace(card.Answer)): true}
	for _, d := range card.Distractors {
		if v := strings.TrimSpace(d); v != "" && !seen[strings.ToLower(v)] {
			seen[strings.ToLower(v)] = true
			if len(seen) >= 2 {
				return true
			}
		}
	}
	for _, other := range cards {
		v := strings.ToLower(strings.TrimSpace(other.Answer))
		if v != "" && !seen[v] {
			return true
		}
	}
	return false
}

func buildOptions(card model.Card, cards []model.Card, rng *rand.Rand) ([]model.Option, string) {
	seen := map[string]bool{strings.ToLower(strings.TrimSpace(card.Answer)): true}
	distractors := make([]string, 0, MaxOptions-1)

	// Prefer distractors written by the author.
	for _, d := range card.Distractors {
		d = strings.TrimSpace(d)
		key := strings.ToLower(d)
		if d == "" || seen[key] {
			continue
		}
		seen[key] = true
		distractors = append(distractors, d)
		if len(distractors) == MaxOptions-1 {
			break
		}
	}

	// Fill the remaining slots with answers from other cards.
	if len(distractors) < MaxOptions-1 {
		others := make([]string, 0, len(cards))
		for _, other := range cards {
			v := strings.TrimSpace(other.Answer)
			key := strings.ToLower(v)
			if v == "" || seen[key] {
				continue
			}
			seen[key] = true
			others = append(others, v)
		}
		rng.Shuffle(len(others), func(i, j int) {
			others[i], others[j] = others[j], others[i]
		})
		room := (MaxOptions - 1) - len(distractors)
		if room > len(others) {
			room = len(others)
		}
		distractors = append(distractors, others[:room]...)
	}

	texts := append([]string{card.Answer}, distractors...)
	rng.Shuffle(len(texts), func(i, j int) {
		texts[i], texts[j] = texts[j], texts[i]
	})

	options := make([]model.Option, len(texts))
	correctID := ""
	for i, text := range texts {
		id := string(rune('a' + i))
		options[i] = model.Option{ID: id, Text: text}
		if text == card.Answer {
			correctID = id
		}
	}
	return options, correctID
}

// NormalizeAnswer lowercases, trims, collapses whitespace and strips
// surrounding/trailing punctuation so typed answers are forgiving.
func NormalizeAnswer(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.Trim(s, "\"'`“”‘’")
	s = strings.Join(strings.Fields(s), " ")
	s = strings.TrimRight(s, ".,;:!?")
	return strings.TrimSpace(s)
}

// CheckWritten reports whether a typed answer matches the expected answer.
// Alternative answers may be separated with "|".
func CheckWritten(expected, given string) bool {
	givenNorm := NormalizeAnswer(given)
	if givenNorm == "" {
		return false
	}
	for _, alt := range strings.Split(expected, "|") {
		if NormalizeAnswer(alt) == givenNorm {
			return true
		}
	}
	return false
}
