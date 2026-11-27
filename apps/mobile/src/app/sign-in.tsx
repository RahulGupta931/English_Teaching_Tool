import { useLocalSearchParams } from "expo-router";
import { Check, Eye, EyeOff, Mail, Mic, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BackButton, Button, Card, ErrorText, H1, Muted, Screen, s as ui } from "@/components/ui";
import { errorText } from "@/lib/api";
import { signInWithGoogle } from "@/lib/google";
import { supabase } from "@/lib/supabase";
import { C, F, themed } from "@/lib/theme";

const MIN_PASSWORD = 8;
type Mode = "signin" | "signup" | "forgot";
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Sign in or create an account: Google, or email and password. Forgot password sends a reset link (same rules as the web app). */
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | "resend" | null>(null);
  const [error, setError] = useState(supabase ? "" : "Sign-in isn't set up. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.");
  const [sent, setSent] = useState<"confirm" | "reset" | null>(null); // after sign-up or a reset request

  const emailOk = looksLikeEmail(email);
  const longEnough = password.length >= MIN_PASSWORD;
  const matches = confirm.length > 0 && confirm === password;
  const ready = !!supabase && emailOk && (mode === "forgot" || (mode === "signin" ? password.length > 0 : longEnough && matches));

  const switchTo = (m: Mode) => {
    setMode(m);
    setError("");
    setSent(null);
    setConfirm("");
  };

  async function google() {
    setBusy("google");
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!supabase || !ready) return;
    setBusy("email");
    setError("");
    try {
      if (mode === "forgot") {
        // The reset link opens the web app, where the new password is set.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setSent("reset");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setSent("confirm"); // with a session, the root layout moves on by itself
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (!supabase) return;
    setBusy("resend");
    setError("");
    try {
      const { error } = sent === "reset"
        ? await supabase.auth.resetPasswordForEmail(email.trim())
        : await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) throw error;
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  // After sign-up or a reset request: say where the email went, and let them resend it.
  if (sent) {
    return (
      <Screen scroll style={{ gap: 18 }}>
        <BackButton />
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <View style={s.mailIcon}><Mail size={28} color={C.onMint} /></View>
          <H1 style={{ fontSize: 24, textAlign: "center" }}>Check your inbox</H1>
          <Muted style={{ textAlign: "center" }}>
            {sent === "confirm"
              ? <>We sent a link to <Text style={s.bold}>{email.trim()}</Text>. Tap it to confirm your email, then sign in here.</>
              : <>If <Text style={s.bold}>{email.trim()}</Text> has an account, we sent a link to reset the password.</>}
          </Muted>
          <Muted style={{ textAlign: "center", fontSize: 13 }}>Can&apos;t find it? Check your spam folder.</Muted>
        </Card>
        <Button title="Resend email" tone="grey" busy={busy === "resend"} onPress={resend} />
        <Button title="Back to sign in" tone="dark" onPress={() => switchTo("signin")} />
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen scroll style={{ gap: 16 }}>
      <BackButton />
      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={s.logo}><Mic size={26} color={C.mint} strokeWidth={2.2} /></View>
        <H1 style={{ fontSize: 26, textAlign: "center" }}>
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}
        </H1>
        <Muted style={{ textAlign: "center" }}>
          {mode === "forgot" ? "Enter your email and we'll send you a link to set a new password." : "Free to start. No card needed."}
        </Muted>
      </View>

      {mode !== "forgot" && (
        <>
          {/* Sign in / Create account, always visible so switching is one tap */}
          <View style={s.tabs} accessibilityRole="tablist">
            {(["signin", "signup"] as const).map((m) => (
              <Pressable key={m} accessibilityRole="tab" accessibilityLabel={m === "signin" ? "Sign in" : "Create account"} accessibilityState={{ selected: mode === m }} onPress={() => switchTo(m)}
                style={[s.tab, mode === m && s.tabOn]}>
                <Text style={[s.tabText, mode === m && { color: C.ink }]}>{m === "signin" ? "Sign in" : "Create account"}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" onPress={google} disabled={!supabase || !!busy} style={({ pressed }) => [s.google, (pressed || !supabase) && { opacity: 0.7 }]}>
            <Text style={s.g}>G</Text>
            <Text style={s.googleText}>{busy === "google" ? "Opening Google…" : "Continue with Google"}</Text>
          </Pressable>

          <View style={s.or}>
            <View style={s.line} />
            <Muted style={{ fontSize: 13 }}>or use your email</Muted>
            <View style={s.line} />
          </View>
        </>
      )}

      <View style={{ gap: 6 }}>
        <Text style={s.label}>Email</Text>
        <TextInput style={ui.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" autoCorrect={false}
          keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={C.muted} accessibilityLabel="Email"
          returnKeyType={mode === "forgot" ? "send" : "next"} onSubmitEditing={mode === "forgot" ? submit : undefined} />
        {email.length > 3 && !emailOk && <Text style={s.hintBad}>That doesn&apos;t look like an email address yet.</Text>}
      </View>

      {mode !== "forgot" && (
        <View style={{ gap: 6 }}>
          <View style={s.between}>
            <Text style={s.label}>Password</Text>
            {mode === "signin" && <Text style={s.link} onPress={() => switchTo("forgot")} accessibilityRole="link">Forgot password?</Text>}
          </View>
          <View style={{ justifyContent: "center" }}>
            <TextInput style={[ui.input, { paddingRight: 52 }]} value={password} onChangeText={setPassword} secureTextEntry={!show} accessibilityLabel="Password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"} returnKeyType={mode === "signup" ? "next" : "go"}
              onSubmitEditing={mode === "signin" ? submit : undefined} />
            <Pressable accessibilityRole="button" accessibilityLabel={show ? "Hide password" : "Show password"} onPress={() => setShow(!show)}
              hitSlop={10} style={{ position: "absolute", right: 14 }}>
              {show ? <EyeOff size={20} color={C.muted} /> : <Eye size={20} color={C.muted} />}
            </Pressable>
          </View>
        </View>
      )}

      {mode === "signup" && (
        <>
          <View style={{ gap: 6 }}>
            <Text style={s.label}>Confirm password</Text>
            <TextInput style={ui.input} value={confirm} onChangeText={setConfirm} secureTextEntry={!show} autoComplete="new-password"
              accessibilityLabel="Confirm password" returnKeyType="go" onSubmitEditing={submit} />
          </View>
          {/* Live checklist so they know the rules before pressing the button */}
          <View style={{ gap: 6 }}>
            <Rule ok={longEnough} text={`At least ${MIN_PASSWORD} characters`} />
            <Rule ok={matches} text="Both passwords match" />
          </View>
        </>
      )}

      <Button tone="dark" busy={busy === "email"} disabled={!ready || !!busy} onPress={submit}
        title={mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"} />
      <ErrorText>{error}</ErrorText>

      {mode === "forgot" ? (
        <Text style={[s.link, { textAlign: "center" }]} onPress={() => switchTo("signin")} accessibilityRole="link">Back to sign in</Text>
      ) : (
        <Text style={s.switch}>
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <Text style={s.link} onPress={() => switchTo(mode === "signin" ? "signup" : "signin")} accessibilityRole="link">
            {mode === "signin" ? "Create an account" : "Sign in"}
          </Text>
        </Text>
      )}

      <View style={s.trust}>
        <ShieldCheck size={16} color={C.muted} />
        <Muted style={{ flex: 1, fontSize: 12 }}>Your recordings are scored and then deleted. They are never stored.</Muted>
      </View>
    </Screen>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityLabel={`${text}: ${ok ? "done" : "not yet"}`}>
      <View style={[s.rule, ok && { backgroundColor: C.mint, borderColor: C.mint }]}>{ok && <Check size={11} color={C.onMint} strokeWidth={3} />}</View>
      <Text style={[s.ruleText, ok && { color: C.ink }]}>{text}</Text>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  logo: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  mailIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  bold: { fontFamily: F.bold, color: C.ink },
  tabs: { flexDirection: "row", backgroundColor: C.grey, borderRadius: 999, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 999 },
  tabOn: { backgroundColor: C.bg },
  tabText: { fontFamily: F.semibold, fontSize: 14, color: C.muted },
  google: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 50, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.bg },
  g: { fontFamily: F.extrabold, fontSize: 18, color: C.blue },
  googleText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  or: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: C.line },
  label: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { fontFamily: F.bold, fontSize: 14, color: C.blue },
  hintBad: { fontFamily: F.medium, fontSize: 12, color: C.redText },
  rule: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.absent, alignItems: "center", justifyContent: "center" },
  ruleText: { fontFamily: F.medium, fontSize: 13, color: C.muted },
  switch: { fontFamily: F.regular, fontSize: 14, color: C.muted, textAlign: "center" },
  trust: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
}));
