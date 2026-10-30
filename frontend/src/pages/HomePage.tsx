import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  FileTextIcon,
  HistoryIcon,
  LayersIcon,
  PlusIcon,
  SparklesIcon,
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
  formatShortDate,
  modeLabel,
  percent,
  studyTime,
} from "../lib/format";
import { useApi } from "../lib/useApi";
import type { Attempt, Deck } from "../types";

function DeckCard({ deck, index }: { deck: Deck; index: number }) {
  return (
    <Link
      to={`/decks/${deck.id}`}
      className="group animate-fade-up flex flex-col rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_1px_0_rgba(29,42,37,0.03),0_20px_40px_-32px_rgba(29,42,37,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_1px_0_rgba(29,42,37,0.03),0_28px_48px_-30px_rgba(15,118,110,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand-dark">
          <BookOpenIcon className="h-5 w-5" />
        </span>
        <ArrowRightIcon className="h-5 w-5 text-ink/25 transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
      </div>

      <h3 className="mt-5 line-clamp-2 font-serif text-xl font-semibold leading-snug">
        {deck.name}
      </h3>
      <p className="mt-1.5 text-sm text-ink-soft">
        {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"} ·{" "}
        {formatShortDate(deck.createdAt)}
      </p>

      <div className="mt-auto flex items-center justify-between border-t border-ink/8 pt-4">
        <span className="text-sm font-semibold text-brand-dark">
          Study deck
        </span>
        <span className="text-xs font-medium text-ink-soft">
          ~{studyTime(deck.cardCount)}
        </span>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="h-[196px] animate-pulse rounded-3xl border border-ink/10 bg-white/70 p-5">
      <div className="h-11 w-11 rounded-2xl bg-ink/5" />
      <div className="mt-5 h-5 w-2/3 rounded bg-ink/5" />
      <div className="mt-3 h-4 w-1/2 rounded bg-ink/5" />
    </div>
  );
}

function RecentRow({ attempt }: { attempt: Attempt }) {
  const pct = percent(attempt.score, attempt.total);
  return (
    <Link
      to={`/results/${attempt.id}`}
      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper/60"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper-deep text-ink-soft">
        <HistoryIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{attempt.deckName}</p>
        <p className="text-xs text-ink-soft">
          {modeLabel(attempt.mode)} · {formatShortDate(attempt.createdAt)}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "text-sm font-bold",
            pct >= 80
              ? "text-brand-dark"
              : pct >= 50
                ? "text-amber-700"
                : "text-rose-700",
          )}
        >
          {pct}%
        </p>
        <p className="text-xs text-ink-soft">
          {attempt.score}/{attempt.total}
        </p>
      </div>
    </Link>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-up">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-3xl border border-ink/10 bg-paper-deep" />
      <div className="relative -rotate-1 rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_30px_60px_-30px_rgba(28,42,37,0.45)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
            <FileTextIcon className="h-3.5 w-3.5" /> biology.csv
          </span>
          <Badge tone="brand">8 cards</Badge>
        </div>

        <pre className="mt-3 overflow-hidden rounded-xl bg-ink px-4 py-3 text-[11px] leading-6 text-paper/85">
          <code>
            question,answer{"\n"}
            What is the powerhouse of the cell?,{"\n"}
            Mitochondria{"\n"}
            Genetic material?,DNA{"\n"}
            Basic unit of life?,The cell
          </code>
        </pre>

        <div className="mt-4 rounded-2xl border border-ink/10 bg-paper/70 p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
            <span>Question 3 of 8</span>
            <span className="text-brand-dark">Multiple choice</span>
          </div>
          <p className="mt-2 font-serif text-lg leading-snug">
            What is the powerhouse of the cell?
          </p>
          <div className="mt-3 grid gap-2">
            {[
              { label: "A", text: "Nucleus", correct: false },
              { label: "B", text: "Mitochondria", correct: true },
              { label: "C", text: "Ribosome", correct: false },
            ].map((option) => (
              <div
                key={option.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium",
                  option.correct
                    ? "border-brand/40 bg-brand-soft/60 text-brand-dark"
                    : "border-ink/10 bg-white text-ink-soft",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold",
                    option.correct
                      ? "bg-brand text-white"
                      : "bg-ink/5 text-ink-soft",
                  )}
                >
                  {option.correct ? (
                    <CheckIcon className="h-3 w-3" />
                  ) : (
                    option.label
                  )}
                </span>
                {option.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const decks = useApi(api.listDecks, []);
  const history = useApi(() => api.listHistory(5), []);
  const deckList = decks.data?.decks ?? [];
  const attempts = history.data?.attempts ?? [];

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-soft/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 top-40 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl" />

        <Container className="relative pb-14 pt-12 lg:pb-20 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="animate-fade-up">
              <Badge tone="brand" className="gap-1.5">
                <SparklesIcon className="h-3.5 w-3.5" />
                CSV in. Quiz out.
              </Badge>

              <h1 className="mt-5 max-w-xl font-serif text-5xl font-semibold leading-[1.03] tracking-tight sm:text-6xl">
                Make your notes{" "}
                <span className="italic text-brand">quiz themselves.</span>
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-ink-soft sm:text-lg">
                Paste a CSV of questions and answers. Recall turns it into
                multiple-choice and written quizzes, then tracks how well you
                actually know it.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton to="/import" size="lg">
                  <PlusIcon className="h-4 w-4" />
                  Create a quiz
                </LinkButton>
                <LinkButton to="/history" variant="secondary" size="lg">
                  <HistoryIcon className="h-4 w-4" />
                  View history
                </LinkButton>
              </div>

              <dl className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-ink-soft">
                {[
                  "No account needed",
                  "Stored locally in SQLite",
                  "Multiple-choice + written",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckIcon className="h-3.5 w-3.5 text-brand" />
                    {item}
                  </div>
                ))}
              </dl>
            </div>

            <div className="hidden sm:block">
              <HeroPreview />
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-ink/10 bg-white/35">
        <Container className="py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-dark">
                Library
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold">
                Your decks
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {deckList.length > 0 && (
                <span className="text-sm text-ink-soft">
                  {deckList.length} {deckList.length === 1 ? "deck" : "decks"}
                </span>
              )}
              <Link
                to="/import"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-dark hover:text-brand"
              >
                New deck <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-7">
            {decks.loading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            )}

            {!decks.loading && decks.error && (
              <ErrorPanel
                message={decks.error}
                onRetry={decks.reload}
                title="Could not load your decks"
              />
            )}

            {!decks.loading && !decks.error && deckList.length === 0 && (
              <EmptyState
                icon={<LayersIcon className="h-6 w-6" />}
                title="Start with a CSV"
                description="A deck is just a list of questions and answers. Import one to build your first quiz — it takes about ten seconds."
                action={
                  <LinkButton to="/import">
                    <PlusIcon className="h-4 w-4" />
                    Import a deck
                  </LinkButton>
                }
              />
            )}

            {!decks.loading && !decks.error && deckList.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deckList.map((deck, index) => (
                  <DeckCard key={deck.id} deck={deck} index={index} />
                ))}
                <Link
                  to="/import"
                  className="group flex min-h-[196px] flex-col items-center justify-center rounded-3xl border border-dashed border-ink/20 bg-white/40 p-5 text-center transition-colors hover:border-brand/40 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-dark shadow-sm transition-transform group-hover:scale-105">
                    <PlusIcon className="h-5 w-5" />
                  </span>
                  <span className="mt-4 text-sm font-semibold">
                    Add another deck
                  </span>
                  <span className="mt-1 text-xs text-ink-soft">
                    Paste or upload a CSV
                  </span>
                </Link>
              </div>
            )}
          </div>

          {attempts.length > 0 && (
            <Panel className="mt-8 overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink/8 px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <HistoryIcon className="h-4 w-4 text-ink-soft" />
                  Recent sessions
                </h3>
                <Link
                  to="/history"
                  className="text-xs font-semibold text-brand-dark hover:text-brand"
                >
                  View all
                </Link>
              </div>
              <div className="divide-y divide-ink/8">
                {attempts.map((attempt) => (
                  <RecentRow key={attempt.id} attempt={attempt} />
                ))}
              </div>
            </Panel>
          )}
        </Container>
      </section>

      <Container className="py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Paste your CSV",
              body: "Question and answer columns are all you need. Add explanations or distractors when you want more control.",
            },
            {
              step: "02",
              title: "Pick a format",
              body: "Generate multiple-choice questions from your other answers, or practice recall with written answers.",
            },
            {
              step: "03",
              title: "Learn from the gaps",
              body: "Every attempt is scored and saved, with a full review of what you missed.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-ink/10 bg-white/50 p-5">
              <span className="font-serif text-2xl font-semibold text-brand/40">
                {item.step}
              </span>
              <h3 className="mt-2 font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
