import { useState, useCallback } from 'react';
import type { QueryResult, QueryError } from '../types';

interface UseQueryReturn {
  result: QueryResult | null;
  loading: boolean;
  error: QueryError | null;
  execute: (datasourceId: string, sql: string) => Promise<void>;
  clear: () => void;
}

export function useQuery(): UseQueryReturn {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<QueryError | null>(null);

  const execute = useCallback(async (datasourceId: string, sql: string) => {
    if (!datasourceId || !sql.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/datasources/${datasourceId}/_query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'sql',
          payload: sql,
          limit: 1000,
          options: {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data.message || `Query failed: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      // The response format may vary - normalize it
      const records = Array.isArray(data) ? data : data.records || data.data || [];
      const fields = data.fields || data.metadata?.fields;

      setResult({
        records,
        fields,
        total: data.total ?? records.length,
        truncated: data.truncated,
      });
    } catch (err) {
      const queryError: QueryError = {
        message: err instanceof Error ? err.message : (err as QueryError).message || 'Query failed',
        statusCode: (err as QueryError).statusCode,
      };
      setError(queryError);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, execute, clear };
}
