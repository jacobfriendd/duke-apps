import { useState, useEffect, useRef } from 'react';
import type { Field, Mapping } from '../types';

export interface TableFields {
  mapping: Mapping;
  fields: Field[];
}

export function useSchemaFields(datasourceId: string | null, mappings: Mapping[]) {
  const [tableFields, setTableFields] = useState<TableFields[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!datasourceId || mappings.length === 0) {
      setTableFields([]);
      fetchedKeyRef.current = null;
      return;
    }

    // Create a key based on datasource + mapping IDs to detect changes
    const mappingIds = mappings.map(m => m.id).sort().join(',');
    const fetchKey = `${datasourceId}:${mappingIds}`;

    // Avoid re-fetching for same datasource + mappings
    if (fetchedKeyRef.current === fetchKey) {
      return;
    }

    async function fetchAllFields() {
      setLoading(true);
      fetchedKeyRef.current = fetchKey;

      const results: TableFields[] = [];

      // Fetch fields for all mappings in parallel (batched to avoid overwhelming the server)
      const batchSize = 5;
      for (let i = 0; i < mappings.length; i += batchSize) {
        const batch = mappings.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (mapping) => {
            try {
              const url = `/api/datasources/${datasourceId}/mappings/${mapping.restId}/fields-list`;
              const response = await fetch(url);
              if (!response.ok) return { mapping, fields: [] };
              const fields = await response.json();
              return { mapping, fields };
            } catch {
              return { mapping, fields: [] };
            }
          })
        );
        results.push(...batchResults);
      }

      setTableFields(results);
      setLoading(false);
    }

    fetchAllFields();
  }, [datasourceId, mappings]);

  return { tableFields, loading };
}
