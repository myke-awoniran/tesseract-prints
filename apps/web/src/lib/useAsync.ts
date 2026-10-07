import { useEffect, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react';
import { errorMessage, isAbort } from './api';

export interface AsyncState<T> {
  loading: boolean;
  data: T | null;
  error: string;
}

/** Loads data when `deps` change, cancelling the previous request. */
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, deps: DependencyList): [AsyncState<T>, Dispatch<SetStateAction<AsyncState<T>>>] {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, data: null, error: '' });

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    loader(ctrl.signal)
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((err: unknown) => {
        if (!isAbort(err)) setState({ loading: false, data: null, error: errorMessage(err) });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [state, setState];
}
