import { useCallback, useEffect, useRef, useState } from "react";
import { RESOURCE_NETWORK_URL, lookupServiceArea } from "shared-ui";
import { useSession } from "./session.jsx";

/**
 * Small data-loading helper. Deliberately not React Query - Architecture
 * doc section 3 calls for component state + fetch until there is a real
 * cross-screen caching problem.
 */
export function useLoad(loader, deps = [], { pollMs } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await loaderRef.current();
      if (mounted.current) setState({ data, error: null, loading: false });
      return data;
    } catch (err) {
      if (mounted.current) setState((s) => ({ data: s.data, error: err, loading: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!pollMs) return undefined;
    // No websockets/notifications in the backend yet (see the backend gaps
    // note in the design handover) - screens that need to see a change made
    // by someone else poll on a slow interval.
    const id = setInterval(() => run({ quiet: true }), pollMs);
    return () => clearInterval(id);
  }, [pollMs, run]);

  return { ...state, reload: run };
}

/** Tracks a one-off action (save, approve, accept) with busy + error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (fn, { onError } = {}) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(onError ? onError(err) : err.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

/** Transient confirmation message ("Saved", "Request sent"). */
export function useToast(ms = 2600) {
  const [message, setMessage] = useState(null);
  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(() => setMessage(null), ms);
    return () => clearTimeout(id);
  }, [message, ms]);
  return [message, setMessage];
}

// Service-area lookups are pure reference data and get hit once per job
// card, so cache them for the page's lifetime. Key is rounded to ~100 m,
// which is well inside any pilot area's radius.
const areaCache = new Map();

/**
 * Village/area name for a job location. Jobs only carry lat/lng - there is
 * no address field on the API - so the pilot service area is the closest
 * thing to a human-readable place name.
 */
export function useAreaName(lat, lng) {
  const { session } = useSession();
  const [area, setArea] = useState(() => areaCache.get(keyFor(lat, lng)));

  useEffect(() => {
    if (lat === undefined || lat === null || !session) return undefined;
    const key = keyFor(lat, lng);
    if (areaCache.has(key)) { setArea(areaCache.get(key)); return undefined; }
    let cancelled = false;
    lookupServiceArea(RESOURCE_NETWORK_URL, session.token, { lat, lng })
      .then((a) => { areaCache.set(key, a); if (!cancelled) setArea(a); })
      // 404 is the expected answer outside the pilot villages, not an error.
      .catch(() => { areaCache.set(key, null); if (!cancelled) setArea(null); });
    return () => { cancelled = true; };
  }, [lat, lng, session]);

  return area;
}

function keyFor(lat, lng) {
  return `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
}

export function clearAreaCache() {
  areaCache.clear();
}
