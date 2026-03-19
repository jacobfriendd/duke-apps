import { useState, useEffect } from 'react';
import type { Datasource } from '../types';

export function useDatasources() {
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchDatasources() {
      try {
        setLoading(true);
        const response = await fetch('/api/datasources-list');
        if (!response.ok) {
          throw new Error(`Failed to fetch datasources: ${response.statusText}`);
        }
        const data = await response.json();
        // Filter to datasources that support SQL language
        const sqlDatasources = data.filter(
          (ds: Datasource) => ds.languages?.includes('sql') || ds.family === 'sql'
        );
        setDatasources(sqlDatasources);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchDatasources();
  }, []);

  return { datasources, loading, error };
}
