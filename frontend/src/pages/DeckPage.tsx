import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  ListChecksIcon,
  PenLineIcon,
  PlayIcon,
  SearchIcon,
  ShuffleIcon,
  TrashIcon,
} from "../components/icons";
import {
  Badge,
  Button,
  Container,
  ErrorPanel,
  PageLoader,
  Panel,
  Spinner,
  cn,
} from "../components/ui";
import { api } from "../lib/api";
import { formatShortDate, studyTime } from "../lib/format";
import { useApi } from "../lib/useApi";
import type { QuizMode } from "../types";

const MODES: Array<{
  key: QuizMode;
  label: string;
  description: string;
  icon: typeof ListChecksIcon;
}> = [
  {
    key: "multiple_choice",
    label: "Multiple choice",
    description: "Four options, one right answer.",
    icon: ListChecksIcon,
  },
  {
    key: "written",
    label: "Written answer",
    description: "Type the answer from memory.",
    icon: PenLineIcon,
  },
  {
    key: "mixed",
    label: "Mixed",
    description: "Alternate between both formats.",
    icon: ShuffleIcon,
  },
];

export function DeckPage() {
  const { deckId = "" } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(
    () => api.getDeck(deckId),
    [deckId],
  );

  const [mode, setMode] = useState<QuizMode>("multiple_choice");
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState("");
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cardCount = data?.cards.length ?? 0;
  const maxQuestions = Math.max(1, Math.min(cardCount, 100));
  const cards = data?.cards ?? [];

  useEffect(() => {
    if (!data) return;
    setCount((current) =>
      Math.min(Math.max(1, current), Math.max(1, data.cards.length)),
    );
  }, [data]);

  const uniqueAnswers = new Set(
    cards.map((card) => card.answer.trim().toLowerCase()),
  ).size;
  const hasDistractors = cards.some(
    (card) => (card.distractors?.length ?? 0) > 0,
  );
  const canUseMultipleChoice = uniqueAnswers >= 2 || hasDistractors;

  const query = filter.trim().toLowerCase();
  const filteredCards = cards
    .map((card, index) => ({ card, index }))
    .filter(
      ({ card }) =>
        !query ||
        card.question.toLowerCase().includes(query) ||
        card.answer.toLowerCase().includes(query),
    );

  async function startQuiz() {
    if (!data) return;
    setStarting(true);
    setActionError(null);
    try {
      const { quiz } = await api.createQuiz(data.deck.id, { mode, count });
      navigate(`/quiz/${quiz.id}`);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Could not start the quiz.",
      );
      setStarting(false);
    }
  }

  async function deleteDeck() {
    if (!data) return;
    const confirmed = window.confirm(
      `Delete “${data.deck.name}”? This also deletes its quiz history.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.deleteDeck(data.deck.id);
      navigate("/");
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Could not delete the deck.",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLoader label="Opening deck…" />;
  }

  if (error || !data) {
    return (
      <Container className="py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to decks
        </Link>
        <div className="mt-6">
          <ErrorPanel
            title="Could not open this deck"
            message={error ?? "Deck not found."}
            onRetry={reload}
          />
        </div>
      </Container>
    );
  }

  const { deck } = data;

  return (
    <Container className="py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All decks
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            {deck.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <BookOpenIcon className="h-4 w-4" />
              {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              Imported {formatShortDate(deck.createdAt)}
            </span>
          </div>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={deleteDeck}
          disabled={deleting}
        >
          {deleting ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : (
            <TrashIcon className="h-3.5 w-3.5" />
          )}
          Delete deck
        </Button>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {actionError}
        </p>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Panel className="p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="font-serif text-2xl font-semibold">Build a quiz</h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Choose how you want to be tested. Questions are shuffled every time.
          </p>

          <fieldset className="mt-6">
            <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
              Format
            </legend>
            <div className="mt-2.5 space-y-2">
              {MODES.map((option) => {
                const active = mode === option.key;
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(option.key)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                      active
                        ? "border-brand bg-brand-soft/50"
                        : "border-ink/10 bg-white hover:border-ink/25 hover:bg-paper/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        active
                          ? "bg-brand text-white"
                          : "bg-ink/5 text-ink-soft",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-ink-soft">
                        {option.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                        active ? "border-brand" : "border-ink/25",
                      )}
                    >
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-brand" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <label
                htmlFor="question-count"
                className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft"
              >
                Questions
              </label>
              <span className="font-serif text-2xl font-semibold leading-none text-brand-dark">
                {count}
                <span className="ml-1 font-sans text-xs font-medium text-ink-soft">
                  / {maxQuestions}
                </span>
              </span>
            </div>
            <input
              id="question-count"
              type="range"
              min={1}
              max={maxQuestions}
              value={Math.min(count, maxQuestions)}
              onChange={(event) => setCount(Number(event.target.value))}
              className="mt-3 w-full cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[11px] font-medium text-ink-soft">
              <span>1</span>
              <button
                type="button"
                className="font-semibold text-brand-dark hover:text-brand"
                onClick={() => setCount(maxQuestions)}
              >
                Use all {maxQuestions}
              </button>
            </div>
          </div>

          {mode === "multiple_choice" && !canUseMultipleChoice && (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">
              This deck needs at least two different answers, or a distractor
              column, before it can build multiple-choice questions.
            </p>
          )}

          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={startQuiz}
            disabled={
              starting ||
              (mode === "multiple_choice" && !canUseMultipleChoice)
            }
          >
            {starting ? (
              <>
                <Spinner className="h-4 w-4" />
                Building quiz…
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4" />
                Start quiz
              </>
            )}
          </Button>
          <p className="mt-2.5 text-center text-xs text-ink-soft">
            About {studyTime(count)} · No timer
          </p>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-ink/8 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl font-semibold">Cards</h2>
              <Badge tone="neutral">{deck.cardCount}</Badge>
            </div>
            <div className="relative mt-3">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60" />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter cards…"
                aria-label="Filter cards"
                className="h-10 w-full rounded-xl border border-ink/15 bg-paper/40 pl-9 pr-3 text-sm outline-none transition placeholder:text-ink-soft/50 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
              />
            </div>
          </div>

          <div className="max-h-[640px] divide-y divide-ink/8 overflow-y-auto">
            {filteredCards.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-ink-soft">
                No cards match “{filter}”.
              </p>
            )}
            {filteredCards.map(({ card, index }) => (
              <article
                key={card.id ?? index}
                className="flex gap-3 px-4 py-4 sm:px-5"
              >
                <span className="mt-0.5 w-6 shrink-0 text-right text-xs font-bold tabular-nums text-ink/30">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5">
                    {card.question}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-brand-dark">
                    {card.answer}
                  </p>
                  {card.explanation && (
                    <p className="mt-1.5 text-xs leading-5 text-ink-soft">
                      {card.explanation}
                    </p>
                  )}
                  {card.distractors && card.distractors.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {card.distractors.map((distractor) => (
                        <span
                          key={distractor}
                          className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] font-medium text-ink-soft"
                        >
                          {distractor}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/50 px-5 py-4">
        <p className="text-sm text-ink-soft">
          Want to add more cards? Import a new CSV as a separate deck.
        </p>
        <Link
          to="/import"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark hover:text-brand"
        >
          New deck <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </Container>
  );
}
