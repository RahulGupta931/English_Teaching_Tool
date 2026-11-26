import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, errorText, type Me } from "./api";
import { supabase } from "./supabase";

type State = {
  /** undefined while the saved sign-in is being read, null when signed out. */
  session: Session | null | undefined;
  me: Me | null;
  /** Signed in, but the profile (name, phone, birth year) isn't filled in yet. */
  needsProfile: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const Ctx = createContext<State>({ session: undefined, me: null, needsProfile: false, error: "", refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  // Tagged with the account it was loaded for, so a different sign-in never sees the previous account's data.
  const [data, setData] = useState<{ uid?: string; me: Me | null; needsProfile: boolean; error: string }>({ me: null, needsProfile: false, error: "" });
  const userId = session?.user.id;
  const uidRef = useRef(userId);
  useEffect(() => {
    uidRef.current = userId; // runs before the effect below that loads /v1/me
  }, [userId]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const uid = uidRef.current;
    try {
      const me = await api<Me>("/v1/me");
      setData({ uid, me, needsProfile: false, error: "" });
    } catch (e) {
      const needsProfile = e instanceof ApiError && e.status === 428;
      setData((d) => ({ uid, me: d.uid === uid ? d.me : null, needsProfile, error: needsProfile ? "" : errorText(e) }));
    }
  }, []);

  useEffect(() => {
    if (userId) refresh();
  }, [userId, refresh]);

  const mine = !!userId && data.uid === userId;
  return (
    <Ctx.Provider value={{ session, me: mine ? data.me : null, needsProfile: mine && data.needsProfile, error: mine ? data.error : "", refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
