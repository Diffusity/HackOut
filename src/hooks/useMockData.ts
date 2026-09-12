import { useState, useEffect } from 'react';

/** Generic hook to load static JSON mock data.
 *  The data files are located under src/data/mock and imported at build time.
 *  The generic type T represents the shape of the JSON data.
 */
export function useMockData<T>(fileName: string): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Restrict dynamic import to the specific directory so webpack doesn't bundle everything.
        const mod = await import(`../data/mock/${fileName}`);
        if (!cancelled) {
          setData(mod.default as T);
        }
      } catch (e) {
        console.error('Failed to load mock data', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fileName]);

  return { data, loading };
}
