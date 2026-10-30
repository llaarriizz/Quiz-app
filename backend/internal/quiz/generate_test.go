package quiz

import (
	"errors"
	"math/rand/v2"
	"testing"

	"quizapp/internal/model"
)

func testCards() []model.Card {
	return []model.Card{
		{Question: "Q1", Answer: "A1"},
		{Question: "Q2", Answer: "A2"},
		{Question: "Q3", Answer: "A3"},
		{Question: "Q4", Answer: "A4"},
		{Question: "Q5", Answer: "A5"},
	}
}

func testRand() *rand.Rand { return rand.New(rand.NewPCG(42, 7)) }

func TestGenerateMultipleChoice(t *testing.T) {
	questions, err := GenerateQuestions(testCards(), model.ModeMultipleChoice, 5, testRand())
	if err != nil {
		t.Fatalf("GenerateQuestions: %v", err)
	}
	if len(questions) != 5 {
		t.Fatalf("got %d questions, want 5", len(questions))
	}
	for _, q := range questions {
		if q.Kind != model.KindMultipleChoice {
			t.Errorf("kind = %q", q.Kind)
		}
		if len(q.Options) != 4 {
			t.Fatalf("got %d options, want 4", len(q.Options))
		}
		seen := map[string]bool{}
		correct := false
		for _, opt := range q.Options {
			if seen[opt.Text] {
				t.Errorf("duplicate option %q", opt.Text)
			}
			seen[opt.Text] = true
			if opt.ID == q.CorrectOptionID {
				correct = true
				if opt.Text != q.CorrectAnswer {
					t.Errorf("correct option %q != answer %q", opt.Text, q.CorrectAnswer)
				}
			}
		}
		if !correct {
			t.Errorf("correct option id %q not among options", q.CorrectOptionID)
		}
	}
}

func TestGeneratePrefersAuthoredDistractors(t *testing.T) {
	cards := []model.Card{{Question: "Q", Answer: "Right", Distractors: []string{"Wrong A", "Wrong B"}}}
	questions, err := GenerateQuestions(cards, model.ModeMultipleChoice, 1, testRand())
	if err != nil {
		t.Fatalf("GenerateQuestions: %v", err)
	}
	texts := map[string]bool{}
	for _, opt := range questions[0].Options {
		texts[opt.Text] = true
	}
	if !texts["Wrong A"] || !texts["Wrong B"] || !texts["Right"] || len(texts) != 3 {
		t.Errorf("options = %#v", texts)
	}
}

func TestGenerateWrittenAndMixed(t *testing.T) {
	written, err := GenerateQuestions(testCards(), model.ModeWritten, 5, testRand())
	if err != nil {
		t.Fatalf("written: %v", err)
	}
	for _, q := range written {
		if q.Kind != model.KindWritten || len(q.Options) != 0 {
			t.Errorf("unexpected written question: %+v", q)
		}
	}

	mixed, err := GenerateQuestions(testCards(), model.ModeMixed, 4, testRand())
	if err != nil {
		t.Fatalf("mixed: %v", err)
	}
	kinds := map[string]int{}
	for _, q := range mixed {
		kinds[q.Kind]++
	}
	if kinds[model.KindMultipleChoice] == 0 || kinds[model.KindWritten] == 0 {
		t.Errorf("mixed kinds = %#v", kinds)
	}
}

func TestGenerateCountLimits(t *testing.T) {
	questions, err := GenerateQuestions(testCards(), model.ModeWritten, 0, testRand())
	if err != nil {
		t.Fatalf("GenerateQuestions: %v", err)
	}
	if len(questions) != len(testCards()) {
		t.Errorf("default count = %d, want %d (all cards)", len(questions), len(testCards()))
	}

	many := make([]model.Card, 150)
	for i := range many {
		many[i] = model.Card{Question: "Q", Answer: string(rune('A'+i%26)) + string(rune('a'+i/26))}
	}
	questions, err = GenerateQuestions(many, model.ModeWritten, 500, testRand())
	if err != nil {
		t.Fatalf("GenerateQuestions: %v", err)
	}
	if len(questions) != MaxQuestionCount {
		t.Errorf("got %d questions, want cap %d", len(questions), MaxQuestionCount)
	}
}

func TestGenerateErrors(t *testing.T) {
	if _, err := GenerateQuestions(nil, model.ModeWritten, 5, testRand()); err == nil {
		t.Error("expected error for empty deck")
	}
	if _, err := GenerateQuestions(testCards(), "nonsense", 5, testRand()); err == nil {
		t.Error("expected error for invalid mode")
	}

	single := []model.Card{{Question: "Only", Answer: "Same"}}
	if _, err := GenerateQuestions(single, model.ModeMultipleChoice, 1, testRand()); !errors.Is(err, ErrNotEnoughChoices) {
		t.Errorf("error = %v, want ErrNotEnoughChoices", err)
	}
}

func TestCheckWritten(t *testing.T) {
	tests := []struct {
		expected, given string
		want            bool
	}{
		{"Canberra", "canberra", true},
		{"Canberra", "  CANBERRA. ", true},
		{"New York", "new   york", true},
		{"4", "4", true},
		{"4", "four", false},
		{"color|colour", "Colour", true},
		{"color | colour", "colour", true},
		{"Canberra", "", false},
		{"Canberra", "Sydney", false},
	}
	for _, tc := range tests {
		if got := CheckWritten(tc.expected, tc.given); got != tc.want {
			t.Errorf("CheckWritten(%q, %q) = %v, want %v", tc.expected, tc.given, got, tc.want)
		}
	}
}
