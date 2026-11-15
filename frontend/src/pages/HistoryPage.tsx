import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  BookOpenIcon,
  HistoryIcon,
  PlusIcon,
} from "../components/icons";
import {
  Badge,
  Container,
  EmptyState,
  ErrorPanel,
  LinkButton,
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
import type { Attempt } from "../types";

const TONE_CHIP = {
  good: "bg-brand-soft text-brand-dark",
  ok: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-700",
};

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const pct = percent(attempt.score, attempt.total);
  const tone = TONE_CHIP[scoreTone(pct)];

  return (
    <Link
      to={`/results/${attempt.id}`}
      className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 sm:px-5"
    >
      <span
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xs font-bold",
          tone,
        )}
      >
        {pct}%
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold sm:text-base">
          {attempt.deckName}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {modeLabel(attempt.mode)} · {formatDate(attempt.createdAt)}
        </p>
        <div className="mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-ink/8 sm:hidden">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="hidden w-32 sm:block">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="hidden text-right sm:block">
        <p className="font-serif text-lg font-semibold leading-none">
          {attempt.score}
          <span className="text-ink-soft">/{attempt.total}</span>
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {formatDuration(attempt.durationMs)}
        </p>
      </div>

      <ArrowRightIcon className="h-4 w-4 shrink-0 text-ink/25 transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Panel className="p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-semibold leading-none">
        {value}
      </p>
      <p className="mt-2 text-xs text-ink-soft">{hint}</p>
    </Panel>
  );
}

export function HistoryPage() {
  const { data, error, loading, reload } = useApi(
    () => api.listHistory(50),
    [],
  );
  const attempts = data?.attempts ?? [];

  const average =
    attempts.length > 0
      ? Math.round(
          attempts.reduce(
            (sum, attempt) => sum + percent(attempt.score, attempt.total),
            0,
          ) / attempts.length,
        )
      : 0;
  const best =
    attempts.length > 0
      ? Math.max(
          ...attempts.map((attempt) => percent(attempt.score, attempt.total)),
        )
      : 0;
  const questionsAnswered = attempts.reduce(
    (sum, attempt) => sum + attempt.total,
    0,
  );

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-dark">
            Progress
          </p>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Study history
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
            Every completed quiz is saved here. Revisit any session to see the
            questions you missed.
          </p>
        </div>
        <LinkButton to="/import">
          <PlusIcon className="h-4 w-4" />
          New deck
        </LinkButton>
      </div>

      {loading && (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-[122px] animate-pulse rounded-3xl border border-ink/10 bg-white/70"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-8">
          <ErrorPanel
            title="Could not load your history"
            message={error}
            onRetry={reload}
          />
        </div>
      )}

      {!loading && !error && attempts.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={<HistoryIcon className="h-6 w-6" />}
            title="No sessions yet"
            description="Finish a quiz and it will show up here, complete with your score, timing and a question-by-question review."
            action={
              <LinkButton to="/">
                <BookOpenIcon className="h-4 w-4" />
                Browse decks
              </LinkButton>
            }
          />
        </div>
      )}

      {!loading && !error && attempts.length > 0 && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Sessions"
              value={String(attempts.length)}
              hint="Completed quizzes"
            />
            <Stat
              label="Average score"
              value={`${average}%`}
              hint="Across recent attempts"
            />
            <Stat
              label="Best score"
              value={`${best}%`}
              hint={`${questionsAnswered} questions answered`}
            />
          </div>

          <Panel className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink/8 px-5 py-4">
              <h2 className="font-serif text-xl font-semibold">All sessions</h2>
              <Badge tone="neutral">
                {attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}
              </Badge>
            </div>
            <div className="divide-y divide-ink/8">
              {attempts.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </div>
          </Panel>
        </>
      )}
    </Container>
  );
}
