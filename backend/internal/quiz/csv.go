package quiz

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"

	"quizapp/internal/model"
)

// ErrEmptyCSV is returned when the input contains no usable rows.
var ErrEmptyCSV = errors.New("no cards found in CSV")

// ParseCSV turns a pasted CSV document into cards.
//
// The first row may be a header. Recognised question/answer names include
// question/q/prompt/term/front and answer/a/definition/back/meaning.
// Distractors may be supplied in distractor/wrong/option columns (one per
// column, or several separated by "|" or ";"), and notes in an explanation
// column. Without a header, columns are read positionally:
// question, answer, explanation.
func ParseCSV(input string) ([]model.Card, error) {
	input = strings.TrimPrefix(input, "\ufeff")
	if strings.TrimSpace(input) == "" {
		return nil, ErrEmptyCSV
	}

	reader := csv.NewReader(strings.NewReader(input))
	reader.Comma = detectDelimiter(input)
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("invalid CSV: %w", err)
	}

	// Drop fully empty records.
	rows := make([][]string, 0, len(records))
	for _, row := range records {
		if !isBlankRow(row) {
			rows = append(rows, row)
		}
	}
	if len(rows) == 0 {
		return nil, ErrEmptyCSV
	}

	qIdx, aIdx, expIdx, distractorIdxs := -1, -1, -1, []int{}
	header := false
	if idx, ok := headerIndexes(rows[0]); ok {
		header = true
		qIdx, aIdx, expIdx, distractorIdxs = idx.question, idx.answer, idx.explanation, idx.distractors
	} else {
		// No header: question, answer, optional explanation.
		if len(rows[0]) < 2 {
			return nil, errors.New("CSV needs at least two columns: question and answer")
		}
		qIdx, aIdx = 0, 1
		if len(rows[0]) > 2 {
			expIdx = 2
		}
	}

	data := rows
	if header {
		data = rows[1:]
	}
	if len(data) == 0 {
		return nil, ErrEmptyCSV
	}

	cards := make([]model.Card, 0, len(data))
	seen := make(map[string]bool, len(data))
	for lineNo, row := range data {
		if qIdx >= len(row) || aIdx >= len(row) {
			continue
		}
		question := strings.TrimSpace(row[qIdx])
		answer := strings.TrimSpace(row[aIdx])
		if question == "" && answer == "" {
			continue
		}
		if question == "" {
			return nil, fmt.Errorf("row %d: question is empty", lineNo+1)
		}
		if answer == "" {
			return nil, fmt.Errorf("row %d: answer is empty", lineNo+1)
		}

		card := model.Card{Question: question, Answer: answer}
		if expIdx >= 0 && expIdx < len(row) {
			card.Explanation = strings.TrimSpace(row[expIdx])
		}
		for _, idx := range distractorIdxs {
			if idx >= len(row) {
				continue
			}
			for _, d := range splitList(row[idx]) {
				if !strings.EqualFold(d, answer) {
					card.Distractors = appendUniqueFold(card.Distractors, d)
				}
			}
		}

		key := strings.ToLower(question) + "\x00" + strings.ToLower(answer)
		if seen[key] {
			continue
		}
		seen[key] = true
		cards = append(cards, card)
	}

	if len(cards) == 0 {
		return nil, ErrEmptyCSV
	}
	return cards, nil
}

type columns struct {
	question    int
	answer      int
	explanation int
	distractors []int
}

func headerIndexes(row []string) (columns, bool) {
	cols := columns{question: -1, answer: -1, explanation: -1}
	for i, raw := range row {
		name := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(raw, "\ufeff")))
		name = strings.TrimSuffix(name, "*")
		switch {
		case isQuestionHeader(name):
			if cols.question == -1 {
				cols.question = i
			}
		case isAnswerHeader(name):
			if cols.answer == -1 {
				cols.answer = i
			}
		case isExplanationHeader(name):
			if cols.explanation == -1 {
				cols.explanation = i
			}
		case isDistractorHeader(name):
			cols.distractors = append(cols.distractors, i)
		}
	}
	return cols, cols.question >= 0 && cols.answer >= 0
}

func isQuestionHeader(name string) bool {
	switch name {
	case "question", "questions", "q", "prompt", "term", "front", "word", "concept", "key":
		return true
	}
	return false
}

func isAnswerHeader(name string) bool {
	switch name {
	case "answer", "answers", "a", "definition", "back", "meaning", "translation", "value", "solution":
		return true
	}
	return false
}

func isExplanationHeader(name string) bool {
	switch name {
	case "explanation", "explanations", "note", "notes", "hint", "context", "rationale", "why":
		return true
	}
	return false
}

func isDistractorHeader(name string) bool {
	switch name {
	case "distractor", "distractors", "wrong", "wrong answer", "wrong answers", "option", "options", "choice", "choices":
		return true
	}
	return strings.HasPrefix(name, "distractor") || strings.HasPrefix(name, "wrong") || strings.HasPrefix(name, "option")
}

func detectDelimiter(input string) rune {
	line := input
	if i := strings.IndexByte(line, '\n'); i >= 0 {
		line = line[:i]
	}
	var comma, semicolon, tab int
	inQuotes := false
	for _, r := range line {
		switch {
		case r == '"':
			inQuotes = !inQuotes
		case inQuotes:
		case r == ',':
			comma++
		case r == ';':
			semicolon++
		case r == '\t':
			tab++
		}
	}
	switch {
	case tab > comma && tab >= semicolon:
		return '\t'
	case semicolon > comma:
		return ';'
	default:
		return ','
	}
}

func isBlankRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func splitList(value string) []string {
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == '|' || r == ';'
	})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func appendUniqueFold(list []string, value string) []string {
	for _, existing := range list {
		if strings.EqualFold(existing, value) {
			return list
		}
	}
	return append(list, value)
}
