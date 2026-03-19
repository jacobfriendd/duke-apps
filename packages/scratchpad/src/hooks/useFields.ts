import { useState, useEffect } from 'react';
import type { Field, Mapping } from '../types';

export function useFields(datasourceId: string | null, mapping: Mapping | null) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!datasourceId || !mapping) {
      setFields([]);
      return;
    }

    async function fetchFields() {
      if (!mapping) return;

      try {
        setLoading(true);
        // Use restId which is in the format "schemaId+mappingId"
        const mappingPath = mapping.restId;

        const url = `/api/datasources/${datasourceId}/mappings/${mappingPath}/fields-list`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch fields: ${response.statusText}`);
        }
        const data = await response.json();
        setFields(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchFields();
  }, [datasourceId, mapping]);

  return { fields, loading, error };
}
