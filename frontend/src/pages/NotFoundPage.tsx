import { Container, LinkButton } from "../components/ui";
import { ArrowLeftIcon, SparklesIcon } from "../components/icons";

export function NotFoundPage() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand-dark">
        <SparklesIcon className="h-6 w-6" />
      </span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-brand-dark">
        404
      </p>
      <h1 className="mt-2 max-w-lg font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
        This page is off the syllabus.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">
        The page you were looking for doesn&apos;t exist. Your decks are still
        right where you left them.
      </p>
      <LinkButton to="/" className="mt-7">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to decks
      </LinkButton>
    </Container>
  );
}
