package quiz

import (
	"errors"
	"strings"
	"testing"
)

func TestParseCSVWithHeader(t *testing.T) {
	input := "question,answer,explanation\nWhat is 2+2?,4,Basic addition\nCapital of France?,Paris,\n"
	cards, err := ParseCSV(input)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if len(cards) != 2 {
		t.Fatalf("got %d cards, want 2", len(cards))
	}
	if cards[0].Question != "What is 2+2?" || cards[0].Answer != "4" || cards[0].Explanation != "Basic addition" {
		t.Errorf("unexpected first card: %+v", cards[0])
	}
}

func TestParseCSVWithoutHeader(t *testing.T) {
	cards, err := ParseCSV("What is Go?,A programming language,Compiled and statically typed\n")
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if len(cards) != 1 || cards[0].Answer != "A programming language" {
		t.Fatalf("unexpected cards: %+v", cards)
	}
	if cards[0].Explanation != "Compiled and statically typed" {
		t.Errorf("explanation = %q", cards[0].Explanation)
	}
}

func TestParseCSVAliasesAndDelimiters(t *testing.T) {
	tests := map[string]string{
		"semicolon": "term;definition\nHTTP;A protocol\n",
		"tab":       "Front\tBack\nHello\tBonjour\n",
		"aliases":   "prompt,meaning,notes\nWhat is HTML?,Markup language,Used on the web\n",
	}
	for name, input := range tests {
		t.Run(name, func(t *testing.T) {
			cards, err := ParseCSV(input)
			if err != nil {
				t.Fatalf("ParseCSV: %v", err)
			}
			if len(cards) != 1 || cards[0].Question == "" || cards[0].Answer == "" {
				t.Fatalf("unexpected cards: %+v", cards)
			}
		})
	}
}

func TestParseCSVQuotedAndCRLF(t *testing.T) {
	input := "\ufeffquestion,answer\r\n\"What is the capital of Australia?\",\"Canberra, Australia\"\r\n"
	cards, err := ParseCSV(input)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if cards[0].Answer != "Canberra, Australia" {
		t.Errorf("answer = %q", cards[0].Answer)
	}
}

func TestParseCSVDistractors(t *testing.T) {
	input := "question,answer,distractor1,distractor2,explanation\n" +
		"Which planet is red?,Mars,Venus,Jupiter,Mars is the red planet\n"
	cards, err := ParseCSV(input)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if len(cards[0].Distractors) != 2 || cards[0].Distractors[0] != "Venus" || cards[0].Distractors[1] != "Jupiter" {
		t.Errorf("distractors = %#v", cards[0].Distractors)
	}
}

func TestParseCSVCombinedDistractorsSkippedBlankAndDuplicates(t *testing.T) {
	input := "question,answer,distractors\nQ1,A,\"B|C;D\"\nQ1,A,B\nQ2,B,\n\n"
	cards, err := ParseCSV(input)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if len(cards) != 2 {
		t.Fatalf("got %d cards, want 2 (duplicate dropped)", len(cards))
	}
	if got := strings.Join(cards[0].Distractors, ","); got != "B,C,D" {
		t.Errorf("distractors = %q", got)
	}
}

func TestParseCSVErrors(t *testing.T) {
	tests := map[string]string{
		"empty":          "   \n\n",
		"one column":     "question\nWhat?\n",
		"empty answer":   "question,answer\nWhat?, \n",
		"empty question": "question,answer\n,Answer\n",
	}
	for name, input := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseCSV(input); err == nil {
				t.Fatal("expected an error")
			}
		})
	}

	if _, err := ParseCSV(""); !errors.Is(err, ErrEmptyCSV) {
		t.Errorf("empty input error = %v, want ErrEmptyCSV", err)
	}
}
