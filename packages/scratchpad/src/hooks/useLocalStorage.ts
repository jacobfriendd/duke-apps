import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'sql-scratchpad:';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = STORAGE_PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, [storageKey, value]);

  return [value, setValue];
}

export interface Scratch {
  id: string;
  name: string;
  sql: string;
  datasourceId: string | null;
  createdAt: number;
  updatedAt: number;
}

export function useScratches() {
  const [scratches, setScratches] = useLocalStorage<Scratch[]>('scratches', []);
  const [activeScratchId, setActiveScratchId] = useLocalStorage<string | null>('activeScratchId', null);

  const createScratch = useCallback((name: string, sql: string, datasourceId: string | null): Scratch => {
    const now = Date.now();
    const scratch: Scratch = {
      id: `scratch-${now}`,
      name,
      sql,
      datasourceId,
      createdAt: now,
      updatedAt: now,
    };
    setScratches(prev => [scratch, ...prev]);
    setActiveScratchId(scratch.id);
    return scratch;
  }, [setScratches, setActiveScratchId]);

  const updateScratch = useCallback((id: string, updates: Partial<Pick<Scratch, 'name' | 'sql' | 'datasourceId'>>) => {
    setScratches(prev => prev.map(s =>
      s.id === id
        ? { ...s, ...updates, updatedAt: Date.now() }
        : s
    ));
  }, [setScratches]);

  const deleteScratch = useCallback((id: string) => {
    setScratches(prev => prev.filter(s => s.id !== id));
    if (activeScratchId === id) {
      setActiveScratchId(null);
    }
  }, [setScratches, activeScratchId, setActiveScratchId]);

  const activeScratch = scratches.find(s => s.id === activeScratchId) || null;

  return {
    scratches,
    activeScratch,
    activeScratchId,
    setActiveScratchId,
    createScratch,
    updateScratch,
    deleteScratch,
  };
}
