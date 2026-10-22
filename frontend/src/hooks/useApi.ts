import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, ApiError } from '../lib/api';

// ─── useApiQuery ───────────────────────────────────────────────────────────────

interface UseApiQueryOptions {
  /** Skip the query (don't fetch) */
  skip?: boolean;
  /** Dependencies that trigger a refetch */
  deps?: any[];
}

interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/**
 * Fetch data from a GET endpoint. Returns loading/error/data states.
 * Automatically refetches when `deps` change.
 */
export function useApiQuery<T>(
  path: string,
  options: UseApiQueryOptions = {},
): UseApiQueryResult<T> {
  const { skip = false, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<ApiError | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (skip) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path);
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [path, skip]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData, ...deps]);

  return { data, isLoading, error, refetch: fetchData };
}

// ─── useApiMutation ────────────────────────────────────────────────────────────

interface UseApiMutationResult<TInput, TOutput> {
  mutate: (input: TInput, overridePath?: string) => Promise<TOutput>;
  isLoading: boolean;
  error: ApiError | null;
  reset: () => void;
}

/**
 * Execute a POST/PUT/PATCH/DELETE request.
 * Returns a `mutate` function that triggers the request.
 */
export function useApiMutation<TInput = void, TOutput = any>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
): UseApiMutationResult<TInput, TOutput> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (input: TInput, overridePath?: string): Promise<TOutput> => {
      setIsLoading(true);
      setError(null);
      try {
        const options: RequestInit = { method };
        if (input !== undefined && method !== 'DELETE') {
          options.body = JSON.stringify(input);
        }
        const result = await apiFetch<TOutput>(overridePath ?? path, options);
        return result;
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : new ApiError(0, String(err));
        setError(apiErr);
        throw apiErr;
      } finally {
        setIsLoading(false);
      }
    },
    [path, method],
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { mutate, isLoading, error, reset };
}
