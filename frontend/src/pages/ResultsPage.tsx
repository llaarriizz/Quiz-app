import { Link, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  HistoryIcon,
  LightbulbIcon,
  RotateCcwIcon,
  XIcon,
} from "../components/icons";
import {
  Badge,
  Container,
  ErrorPanel,
  LinkButton,
  PageLoader,
  Panel,
  cn,
} from "../components/ui";
import { api } from "../lib/api";
import {
  formatDate,
  formatDuration,
  modeLabel,
  percent,
  scoreTone,
} from "../lib/format";
import { useApi } from "../lib/useApi";
import type { Attempt, Result } from "../types";

function feedback(value: number) {
  if (value >= 90) {
    return {
      title: "Outstanding recall.",
      body: "You have this deck down cold. Run it again in a few days to keep it fresh.",
    };
  }
  if (value >= 70) {
    return {
      title: "Strong work.",
      body: "Most of it stuck. Review the misses below, then take another pass.",
    };
  }
  if (value >= 50) {
    return {
      title: "Good start.",
      body: "You are halfway there. The review below shows exactly where to focus.",
    };
  }
  return {
    title: "Time for another pass.",
    body: "Read through the answers below, then try the deck again. Repetition is the point.",
  };
}

function ScoreRing({ value, score, total }: { value: number; score: number; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  const color =
    value >= 80
      ? "var(--color-brand)"
      : value >= 50
        ? "#d97706"
        : "#e11d48";

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          className="text-ink/8"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-4xl font-semibold leading-none">
          {value}%
        </span>
        <span className="mt-1 text-xs font-medium text-ink-soft">
          {score} / {total} correct
        </span>
      </div>
    </div>
  );
}

function ResultCard({ result, index }: { result: Result; index: number }) {
  return (
    <Panel
      className={cn(
        "overflow-hidden",
        result.correct ? "border-brand/20" : "border-rose-200/80",
      )}
    >
      <div className="flex gap-3 p-5 sm:gap-4 sm:p-6">
        <span
          className={cn(
            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
            result.correct
              ? "bg-brand-soft text-brand-dark"
              : "bg-rose-100 text-rose-700",
          )}
        >
          {result.correct ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <XIcon className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
              Question {index + 1}
            </p>
            <Badge tone={result.correct ? "brand" : "rose"}>
              {result.correct ? "Correct" : "Review"}
            </Badge>
          </div>

          <p className="mt-1.5 text-balance font-medium leading-6">
            {result.prompt}
          </p>

          <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-paper/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                Your answer
              </p>
              <p
                className={cn(
                  "mt-1 text-sm",
                  result.correct ? "text-brand-dark" : "text-rose-700",
                )}
              >
                {result.yourAnswerText || (
                  <span className="italic text-ink-soft">No answer</span>
                )}
              </p>
            </div>
            {!result.correct && (
              <div className="rounded-xl bg-brand-soft/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-dark/70">
                  Correct answer
                </p>
                <p className="mt-1 text-sm font-medium text-brand-dark">
                  {result.correctAnswer}
                </p>
              </div>
            )}
          </div>

          {result.explanation && (
            <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/80 p-3">
              <LightbulbIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-xs leading-5 text-amber-900">
                {result.explanation}
              </p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function ResultsPage() {
  const { attemptId = "" } = useParams();
  const { data, error, loading, reload } = useApi(
    () => api.getAttempt(attemptId),
    [attemptId],
  );

  if (loading) {
    return <PageLoader label="Scoring your answers…" />;
  }

  if (error || !data) {
    return (
      <Container className="py-12">
        <ErrorPanel
          title="Could not load these results"
          message={error ?? "Attempt not found."}
          onRetry={reload}
        />
        <div className="mt-5">
          <LinkButton to="/history" variant="secondary">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to history
          </LinkButton>
        </div>
      </Container>
    );
  }

  const attempt: Attempt = data.attempt;
  const pct = percent(attempt.score, attempt.total);
  const tone = scoreTone(pct);
  const copy = feedback(pct);
  const correct = attempt.results?.filter((result) => result.correct).length ?? 0;
  const review = (attempt.results?.length ?? attempt.total) - correct;

  return (
    <Container className="max-w-4xl py-8 sm:py-10">
      <Link
        to={`/decks/${attempt.deckId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {attempt.deckName}
      </Link>

      <Panel className="relative mt-5 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-soft/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-amber-100/60 blur-3xl" />

        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center">
          <ScoreRing value={pct} score={attempt.score} total={attempt.total} />

          <div className="min-w-0 flex-1">
            <Badge tone={tone === "good" ? "brand" : tone === "ok" ? "amber" : "rose"}>
              Quiz complete
            </Badge>
            <h1 className="mt-2.5 font-serif text-4xl font-semibold tracking-tight">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-ink-soft">
              {copy.body}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="white">
                <ClockIcon className="h-3 w-3" />
                {formatDuration(attempt.durationMs)}
              </Badge>
              <Badge tone="white">{modeLabel(attempt.mode)}</Badge>
              <Badge tone="white">
                <CalendarIcon className="h-3 w-3" />
                {formatDate(attempt.createdAt)}
              </Badge>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <LinkButton to={`/decks/${attempt.deckId}`}>
                <RotateCcwIcon className="h-4 w-4" />
                Study again
              </LinkButton>
              <LinkButton to="/history" variant="secondary">
                <HistoryIcon className="h-4 w-4" />
                All history
              </LinkButton>
            </div>
          </div>
        </div>
      </Panel>

      {attempt.results && attempt.results.length > 0 && (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-dark">
                Review
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold">
                Question breakdown
              </h2>
            </div>
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-brand-dark">
                {correct} correct
              </span>{" "}
              · {review} to revisit
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {attempt.results.map((result, index) => (
              <ResultCard
                key={result.questionId}
                result={result}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
