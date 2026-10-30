import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
} from "../components/icons";
import {
  Badge,
  Button,
  Container,
  ErrorPanel,
  LinkButton,
  PageLoader,
  Panel,
  Spinner,
  cn,
} from "../components/ui";
import { api } from "../lib/api";
import { modeLabel } from "../lib/format";
import { useApi } from "../lib/useApi";

export function QuizPage() {
  const { quizId = "" } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(
    () => api.getQuiz(quizId),
    [quizId],
  );
  const quiz = data?.quiz ?? null;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    setIndex(0);
    setAnswers({});
    setSubmitting(false);
    setSubmitError(null);
  }, [quizId]);

  useEffect(() => {
    if (quiz && startRef.current === 0) {
      startRef.current = Date.now();
    }
  }, [quiz]);

  const submit = useCallback(
    async (finalAnswers: Record<string, string>) => {
      if (!quiz || submitting) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const { attempt } = await api.submitQuiz(quiz.id, {
          answers: finalAnswers,
          durationMs: Date.now() - startRef.current,
        });
        navigate(`/results/${attempt.id}`, { replace: true });
      } catch (caught) {
        setSubmitError(
          caught instanceof Error ? caught.message : "Could not submit the quiz.",
        );
        setSubmitting(false);
      }
    },
    [quiz, submitting, navigate],
  );

  const current = quiz?.questions[index];
  const answered = current ? answers[current.id] : undefined;
  const isLast = quiz ? index === quiz.questions.length - 1 : false;
  const answeredCount = quiz
    ? quiz.questions.filter((question) => answers[question.id]).length
    : 0;

  const advance = useCallback(() => {
    if (!quiz || !current || submitting) return;
    if (isLast) {
      void submit(answers);
    } else {
      setIndex((value) => value + 1);
    }
  }, [quiz, current, submitting, isLast, submit, answers]);

  useEffect(() => {
    if (!quiz || !current || submitting) return;

    function handleKey(event: KeyboardEvent) {
      const question = current;
      if (!question) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (question.kind === "multiple_choice" && question.options) {
        const numeric = Number(event.key);
        if (
          Number.isInteger(numeric) &&
          numeric >= 1 &&
          numeric <= question.options.length
        ) {
          event.preventDefault();
          const option = question.options[numeric - 1];
          setAnswers((previous) => ({ ...previous, [question.id]: option.id }));
          return;
        }
      }

      if (event.key === "Enter" && answers[question.id]) {
        event.preventDefault();
        advance();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [quiz, current, submitting, answers, advance]);

  if (loading) {
    return <PageLoader label="Preparing your quiz…" />;
  }

  if (error || !quiz) {
    return (
      <Container className="py-12">
        <ErrorPanel
          title="Could not load this quiz"
          message={error ?? "Quiz not found."}
          onRetry={reload}
        />
        <div className="mt-5">
          <LinkButton to="/" variant="secondary">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to decks
          </LinkButton>
        </div>
      </Container>
    );
  }

  if (!current) {
    return (
      <Container className="py-12">
        <ErrorPanel
          title="This quiz has no questions"
          message="Go back to the deck and generate a new quiz."
        />
      </Container>
    );
  }

  const progress = Math.round(((index + 1) / quiz.questions.length) * 100);

  return (
    <Container className="max-w-4xl py-8 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/decks/${quiz.deckId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Exit quiz
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="brand">{modeLabel(quiz.mode)}</Badge>
          <span className="hidden text-xs font-medium text-ink-soft sm:flex sm:items-center sm:gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            No timer
          </span>
        </div>
      </div>

      <div className="mt-4">
        <p className="truncate text-sm font-semibold text-ink-soft">
          {quiz.deckName}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-ink-soft">
          <span>
            Question <span className="font-bold text-ink">{index + 1}</span> of{" "}
            {quiz.questions.length}
          </span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-dark">
              {current.kind === "multiple_choice"
                ? "Choose one answer"
                : "Type your answer"}
            </span>
            <span className="font-serif text-sm tabular-nums text-ink/25">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>

          <h1 className="mt-3 text-balance font-serif text-2xl font-semibold leading-tight sm:text-3xl">
            {current.prompt}
          </h1>

          {current.kind === "multiple_choice" && current.options ? (
            <div className="mt-7 space-y-2.5" role="radiogroup" aria-label="Answer options">
              {current.options.map((option, optionIndex) => {
                const selected = answered === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      setAnswers((previous) => ({
                        ...previous,
                        [current.id]: option.id,
                      }))
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:p-4",
                      selected
                        ? "border-brand bg-brand-soft/50 ring-1 ring-brand/20"
                        : "border-ink/10 bg-white hover:border-ink/25 hover:bg-paper/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold transition-colors",
                        selected
                          ? "bg-brand text-white"
                          : "bg-ink/5 text-ink-soft",
                      )}
                    >
                      {selected ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        String.fromCharCode(65 + optionIndex)
                      )}
                    </span>
                    <span className="flex-1 text-sm font-medium leading-6 sm:text-base">
                      {option.text}
                    </span>
                    <span className="hidden shrink-0 rounded border border-ink/10 px-1.5 py-0.5 text-[10px] font-bold text-ink/30 sm:block">
                      {optionIndex + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                advance();
              }}
              className="mt-7"
            >
              <label htmlFor="written-answer" className="sr-only">
                Your answer
              </label>
              <input
                key={current.id}
                id="written-answer"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={answered ?? ""}
                onChange={(event) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [current.id]: event.target.value,
                  }))
                }
                placeholder="Type what you remember…"
                className="h-14 w-full rounded-2xl border border-ink/15 bg-paper/40 px-4 text-base outline-none transition placeholder:text-ink-soft/45 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
              />
              <p className="mt-2 text-xs text-ink-soft">
                Case, punctuation and extra spaces are ignored. Press Enter to
                continue.
              </p>
            </form>
          )}
        </div>
      </Panel>

      {submitError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {submitError}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0 || submitting}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </Button>

        <p className="hidden text-center text-xs text-ink-soft sm:block">
          {current.kind === "multiple_choice"
            ? "Press 1–4 to choose · Enter to continue"
            : "Press Enter to continue"}
        </p>

        <Button onClick={advance} disabled={submitting}>
          {submitting ? (
            <>
              <Spinner className="h-4 w-4" />
              Scoring…
            </>
          ) : (
            <>
              {isLast ? "Finish quiz" : "Next question"}
              <ArrowRightIcon className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {!answered && !submitting && (
        <p className="mt-3 text-center text-xs font-medium text-amber-700">
          No answer selected — unanswered questions are marked incorrect.
        </p>
      )}
    </Container>
  );
}
