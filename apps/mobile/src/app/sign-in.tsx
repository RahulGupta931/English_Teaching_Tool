import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { BackButton, Body, Button, ErrorText, H1, Muted, Screen, s as ui } from "@/components/ui";
import { errorText } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { C, F } from "@/lib/theme";

const MIN_PASSWORD = 8;
type Mode = "signin" | "signup" | "forgot";

/** Email + password: sign in, create an account, or reset a forgotten password (same rules as the web app). */
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (mode === "forgot") {
        // The reset link opens the web app, where the new password is set.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setMessage("If that email has an account, we've sent a link to reset the password.");
      } else if (mode === "signup") {
        if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setMessage("Check your inbox and click the link to confirm your email. Then sign in here.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in";
  const switchTo = (m: Mode) => {
    setMode(m);
    setMessage("");
    setError("");
  };
  return (
    <Screen scroll>
      <BackButton />
      <H1>{title}</H1>
      {mode !== "forgot" && <Muted>Free to start. No card needed.</Muted>}
      <View style={{ gap: 6 }}>
        <Body style={{ fontFamily: F.semibold }}>Email</Body>
        <TextInput style={ui.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={C.muted} />
      </View>
      {mode !== "forgot" && (
        <View style={{ gap: 6 }}>
          <Body style={{ fontFamily: F.semibold }}>Password</Body>
          {mode === "signup" && <Muted style={{ fontSize: 14 }}>At least {MIN_PASSWORD} characters</Muted>}
          <TextInput style={ui.input} value={password} onChangeText={setPassword} secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </View>
      )}
      <Button tone="dark" busy={busy} disabled={!email || (mode !== "forgot" && !password)} onPress={submit}
        title={mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"} />
      {!!message && <Body style={{ color: C.green2, textAlign: "center" }}>{message}</Body>}
      <ErrorText>{error}</ErrorText>
      {mode === "signin" ? (
        <>
          <Button tone="white" small title="New here? Create an account" onPress={() => switchTo("signup")} />
          <Button tone="white" small title="Forgot password?" onPress={() => switchTo("forgot")} />
        </>
      ) : (
        <Button tone="white" small title="Back to sign in" onPress={() => switchTo("signin")} />
      )}
    </Screen>
  );
}
