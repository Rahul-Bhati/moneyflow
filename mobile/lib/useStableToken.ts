import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useRef } from "react";

/**
 * Clerk's `useAuth().getToken` is a new function reference on every render.
 * Putting it in a `useCallback`/`useEffect` dep array causes a render loop:
 *
 *   render → new getToken → new `load` cb → effect re-fires → fetch → setState
 *     → render → new getToken → ...
 *
 * which was producing dozens of `/api/transactions` + `/api/analytics` calls
 * per minute in dev.
 *
 * This hook returns a STABLE token getter — its identity never changes across
 * renders, so callbacks that depend on it stay stable too. Internally it
 * reads from a ref that's updated each render, so it always calls the latest
 * Clerk function.
 *
 * Usage:
 *   const getToken = useStableToken();
 *   const load = useCallback(async () => {
 *     const data = await api.listX(getToken);
 *   }, [getToken]); // getToken is stable, so this cb is too.
 */
export function useStableToken(): () => Promise<string | null> {
  const { getToken } = useAuth();
  const ref = useRef(getToken);
  ref.current = getToken;
  return useCallback(() => ref.current(), []);
}
