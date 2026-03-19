import { useState, useEffect } from 'react';
import type { Mapping } from '../types';

export function useMappings(datasourceId: string | null) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!datasourceId) {
      setMappings([]);
      return;
    }

    async function fetchMappings() {
      try {
        setLoading(true);
        const response = await fetch(`/api/datasources/${datasourceId}/mappings-list`);
        if (!response.ok) {
          throw new Error(`Failed to fetch mappings: ${response.statusText}`);
        }
        const data = await response.json();
        setMappings(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchMappings();
  }, [datasourceId]);

  return { mappings, loading, error };
}
