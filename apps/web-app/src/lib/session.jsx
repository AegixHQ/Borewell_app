import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { decodeJwtPayload } from "shared-ui";

/**
 * Session state for the whole app.
 *
 * The role kept here drives WHICH SCREENS RENDER - presentation only. It is
 * never an authorization check: every service enforces access server-side
 * with require_role() (see each service's app/deps.py and its isolation
 * tests). A tampered token in localStorage gets a 403 from the API, which
 * is the boundary that matters.
 */

const STORAGE_KEY = "borewell.session";
const SessionContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.token) return null;
    const payload = decodeJwtPayload(saved.token);
    // exp is seconds since epoch; drop an expired token rather than letting
    // every call fail with a 401 the user can't explain.
    if (payload?.exp && payload.exp * 1000 < Date.now()) return null;
    return { ...saved, role: payload.role || saved.role };
  } catch {
    return null;
  }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => readStored());

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing or blocked storage: the session still works for
      // this tab, it just won't survive a refresh.
    }
  }, [session]);

  const signIn = useCallback(({ token, email }) => {
    const payload = decodeJwtPayload(token);
    setSession({ token, email, role: payload.role, userId: payload.sub });
  }, []);

  const signOut = useCallback(() => setSession(null), []);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export const HOME_FOR_ROLE = {
  customer: "/customer",
  contractor: "/contractor",
  admin: "/contractor",
  resource_owner: "/owner",
};
