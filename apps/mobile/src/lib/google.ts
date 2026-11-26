import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

/** Google sign-in in the system browser; Supabase sends the browser back to this app's deep link with a ?code=.
 *  The deep link (e.g. englishcoach://auth-callback) must be in Supabase > Authentication > URL Configuration > Redirect URLs. */
export async function signInWithGoogle() {
  if (!supabase) return;
  const redirectTo = Linking.createURL("auth-callback");
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return; // closed by the user
  const { queryParams } = Linking.parse(result.url);
  if (typeof queryParams?.error_description === "string") throw new Error(queryParams.error_description);
  if (typeof queryParams?.code !== "string") throw new Error("Google sign-in didn't finish. Please try again.");
  const { error: exchange } = await supabase.auth.exchangeCodeForSession(queryParams.code);
  if (exchange) throw exchange;
}
