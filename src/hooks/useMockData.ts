import { useState, useEffect } from 'react';

/** Generic hook to load static JSON mock data.
 *  The data files are located under src/data/mock and imported at build time.
 *  The generic type T represents the shape of the JSON data.
 */
export function useMockData<T>(modulePath: string): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Dynamic import based on the provided relative path from the src directory.
        // Example usage: useMockData<any>('src/data/mock/sipNudge.json')
        const mod = await import(`../${modulePath}`);
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
  }, [modulePath]);

  return { data, loading };
}
