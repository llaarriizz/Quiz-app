export type QuizMode = "multiple_choice" | "written" | "mixed";
export type QuestionKind = "multiple_choice" | "written";

export interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
}

export interface Card {
  id?: string;
  question: string;
  answer: string;
  explanation?: string;
  distractors?: string[];
}

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  prompt: string;
  kind: QuestionKind;
  options?: Option[];
}

export interface Quiz {
  id: string;
  deckId: string;
  deckName: string;
  mode: QuizMode;
  createdAt: string;
  questions: Question[];
}

export interface Result {
  questionId: string;
  prompt: string;
  kind: QuestionKind;
  options?: Option[];
  yourAnswer: string;
  yourAnswerText: string;
  correctAnswer: string;
  correctOptionId?: string;
  explanation?: string;
  correct: boolean;
}

export interface Attempt {
  id: string;
  quizId: string;
  deckId: string;
  deckName: string;
  mode: QuizMode;
  score: number;
  total: number;
  durationMs: number;
  createdAt: string;
  results?: Result[];
}
