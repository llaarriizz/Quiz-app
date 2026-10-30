import { useCallback, useEffect, useState, type DependencyList } from "react";

interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Runs an async loader and tracks loading/error state. Pass the values the
 * loader closes over as `deps`; `reload` re-runs it.
 */
export function useApi<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loader()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          data: null,
          error: error instanceof Error ? error.message : "Something went wrong.",
          loading: false,
        });
      });
    return () => {
      active = false;
    };
    // The caller controls when the loader should re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { ...state, reload };
}
