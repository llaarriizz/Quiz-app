import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayersIcon, PlusIcon } from "./icons";
import { Container, LinkButton, cn } from "./ui";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-ink/5 text-ink"
      : "text-ink-soft hover:bg-ink/5 hover:text-ink",
  );
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between">
          <NavLink to="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-paper shadow-sm transition-colors group-hover:bg-brand">
              <LayersIcon className="h-5 w-5" />
            </span>
            <span className="font-serif text-2xl font-semibold tracking-tight">
              Recall
            </span>
          </NavLink>

          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/" end className={navClass}>
              Decks
            </NavLink>
            <NavLink to="/history" className={navClass}>
              History
            </NavLink>
            <LinkButton to="/import" size="sm" className="ml-1 sm:ml-2">
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">New deck</span>
              <span className="sm:hidden">New</span>
            </LinkButton>
          </nav>
        </Container>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-ink/10">
        <Container className="flex flex-col items-center justify-between gap-2 py-8 text-xs text-ink-soft sm:flex-row">
          <p className="font-medium">Recall — study less randomly.</p>
          <p className="tracking-wide">Go · React · SQLite</p>
        </Container>
      </footer>
    </div>
  );
}
