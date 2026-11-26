import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase Auth client (sign-in only; app data lives in our API) — same project as the web app. Null when not configured. */
export const supabase =
  url && key
    ? createClient(url, key, {
        // Phones have no localStorage; keep the session in AsyncStorage so users stay signed in.
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;
