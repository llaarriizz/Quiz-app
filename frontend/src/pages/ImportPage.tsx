import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  FileTextIcon,
  SparklesIcon,
  UploadIcon,
} from "../components/icons";
import {
  Badge,
  Button,
  Container,
  LinkButton,
  Panel,
  Spinner,
  cn,
} from "../components/ui";
import { api } from "../lib/api";
import { SAMPLE_CSV, SAMPLE_DECK_NAME } from "../lib/sample";

const MAX_FILE_BYTES = 1_500_000;

function prettifyFileName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return "Imported deck";
  return base.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function ImportPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lineCount = csv.trim() ? csv.trim().split(/\r?\n/).length : 0;

  async function loadFile(file: File) {
    setFileError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileError("That file is over 1.5 MB. Try a smaller CSV.");
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        setFileError("That file is empty.");
        return;
      }
      setCsv(text);
      setFileName(file.name);
      setName((current) =>
        current.trim() ? current : prettifyFileName(file.name),
      );
      setError(null);
    } catch {
      setFileError("Could not read that file.");
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csv.trim()) {
      setError("Paste some CSV or upload a file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { deck } = await api.createDeck({
        name: name.trim() || "Untitled deck",
        csv,
      });
      navigate(`/decks/${deck.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not import that deck.",
      );
      setSubmitting(false);
    }
  }

  function loadSample() {
    setCsv(SAMPLE_CSV);
    setName((current) => (current.trim() ? current : SAMPLE_DECK_NAME));
    setFileName(null);
    setFileError(null);
    setError(null);
  }

  return (
    <Container className="py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to decks
      </Link>

      <div className="mt-6 max-w-2xl">
        <Badge tone="brand">New deck</Badge>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Paste your CSV.
          <br />
          Get a quiz.
        </h1>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          Every row becomes a study card. We&apos;ll use the other answers as
          distractors for multiple-choice questions, or you can add your own.
        </p>
      </div>

      <div className="mt-9 grid items-start gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Panel className="p-5 sm:p-6">
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="deck-name"
              className="block text-sm font-semibold text-ink"
            >
              Deck name
            </label>
            <input
              id="deck-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="e.g. Cell Biology — Unit 3"
              className="mt-2 h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-sm outline-none transition placeholder:text-ink-soft/50 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
            />

            <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
              <label
                htmlFor="deck-csv"
                className="text-sm font-semibold text-ink"
              >
                CSV content
              </label>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <UploadIcon className="h-3.5 w-3.5" />
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={loadSample}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Load sample
                </button>
                {csv && (
                  <button
                    type="button"
                    onClick={() => {
                      setCsv("");
                      setFileName(null);
                      setError(null);
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
                event.target.value = "";
              }}
            />

            <div
              className={cn(
                "relative mt-2 rounded-2xl transition-shadow",
                dragging && "ring-4 ring-brand/20",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragging(false);
                }
              }}
              onDrop={handleDrop}
            >
              <textarea
                id="deck-csv"
                value={csv}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setFileName(null);
                  setError(null);
                }}
                rows={14}
                spellCheck={false}
                placeholder={
                  "question,answer,explanation\nWhat is 2 + 2?,4,Basic addition.\nCapital of Japan?,Tokyo,Tokyo became the capital in 1868."
                }
                className="min-h-[320px] w-full resize-y rounded-2xl border border-ink/15 bg-paper/40 p-4 font-mono text-[13px] leading-6 outline-none transition placeholder:text-ink-soft/45 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
              />
              {dragging && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed border-brand bg-brand-soft/90">
                  <p className="flex items-center gap-2 text-sm font-bold text-brand-dark">
                    <UploadIcon className="h-5 w-5" />
                    Drop your CSV here
                  </p>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-soft">
              <span>
                {lineCount > 0
                  ? `${lineCount} ${lineCount === 1 ? "line" : "lines"} pasted`
                  : "Comma, semicolon or tab separated"}
              </span>
              {fileName && <span className="truncate">Loaded {fileName}</span>}
            </div>

            {fileError && (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
                {fileError}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/8 pt-5">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Building deck…
                  </>
                ) : (
                  <>
                    <FileTextIcon className="h-4 w-4" />
                    Create deck
                  </>
                )}
              </Button>
              <LinkButton to="/" variant="ghost">
                Cancel
              </LinkButton>
              <span className="ml-auto hidden text-xs text-ink-soft sm:block">
                You can preview every card before studying.
              </span>
            </div>
          </form>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-5 sm:p-6">
            <h2 className="font-serif text-xl font-semibold">How it works</h2>
            <ol className="mt-4 space-y-4">
              {[
                {
                  number: "1",
                  title: "First row can be a header",
                  body: "We recognise question, term, prompt, answer, definition and a few common aliases.",
                },
                {
                  number: "2",
                  title: "Two columns are enough",
                  body: "Without a header, the first two columns are read as question and answer.",
                },
                {
                  number: "3",
                  title: "Add extras if you like",
                  body: "An explanation column appears in the review. Distractor columns control the wrong options.",
                },
              ].map((item) => (
                <li key={item.number} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-dark">
                    {item.number}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="font-serif text-xl font-semibold">CSV formats</h2>
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <p className="mb-1.5 font-semibold text-ink-soft">Standard</p>
                <pre className="overflow-x-auto rounded-xl bg-ink p-3 leading-5 text-paper/85">
                  <code>question,answer{"\n"}Capital of Japan?,Tokyo</code>
                </pre>
              </div>
              <div>
                <p className="mb-1.5 font-semibold text-ink-soft">
                  With explanation and choices
                </p>
                <pre className="overflow-x-auto rounded-xl bg-ink p-3 leading-5 text-paper/85">
                  <code>
                    question,answer,distractor1,distractor2,explanation{"\n"}
                    Red planet?,Mars,Venus,Jupiter,Iron oxide dust.
                  </code>
                </pre>
              </div>
              <p className="leading-5 text-ink-soft">
                Semicolon and tab delimiters work too. Separate multiple
                distractors with <code className="rounded bg-ink/5 px-1">|</code>{" "}
                or <code className="rounded bg-ink/5 px-1">;</code>.
              </p>
              <p className="leading-5 text-ink-soft">
                Limits: 2,000 cards and 2 MB per import.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </Container>
  );
}
