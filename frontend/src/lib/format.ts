import type { QuizMode } from "../types";

const MODE_LABELS: Record<QuizMode, string> = {
  multiple_choice: "Multiple choice",
  written: "Written",
  mixed: "Mixed",
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode as QuizMode] ?? mode;
}

export function percent(score: number, total: number): number {
  if (!total) return 0;
  return Math.round((score / total) * 100);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export function scoreTone(value: number): "good" | "ok" | "low" {
  if (value >= 80) return "good";
  if (value >= 50) return "ok";
  return "low";
}

export function studyTime(cardCount: number): string {
  return `${Math.max(1, Math.ceil(cardCount / 2))} min`;
}
