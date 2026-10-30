import type { Attempt, Card, Deck, Quiz, QuizMode } from "../types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(
      "Could not reach the server. Make sure the Go API is running.",
      0,
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  listDecks: () => request<{ decks: Deck[] }>("/api/decks"),

  getDeck: (deckId: string) =>
    request<{ deck: Deck; cards: Card[] }>(`/api/decks/${deckId}`),

  createDeck: (input: { name: string; csv: string }) =>
    request<{ deck: Deck; cards: Card[] }>("/api/decks", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteDeck: (deckId: string) =>
    request<void>(`/api/decks/${deckId}`, { method: "DELETE" }),

  createQuiz: (deckId: string, input: { mode: QuizMode; count: number }) =>
    request<{ quiz: Quiz }>(`/api/decks/${deckId}/quizzes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getQuiz: (quizId: string) =>
    request<{ quiz: Quiz }>(`/api/quizzes/${quizId}`),

  submitQuiz: (
    quizId: string,
    input: { answers: Record<string, string>; durationMs: number },
  ) =>
    request<{ attempt: Attempt }>(`/api/quizzes/${quizId}/submit`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getAttempt: (attemptId: string) =>
    request<{ attempt: Attempt }>(`/api/attempts/${attemptId}`),

  listHistory: (limit = 20) =>
    request<{ attempts: Attempt[] }>(`/api/history?limit=${limit}`),
};
