import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Body, Button, Chip, ErrorText, H1, Muted, Screen, s as form } from "@/components/ui";
import { errorText, postJson } from "@/lib/api";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { C, F, themed } from "@/lib/theme";

/** Shown once after the first sign-in: details the API needs that Google and email sign-up don't give us. */
export default function Profile() {
  const { refresh } = useSession();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [consent, setConsent] = useState(false);
  const [lang, setLang] = useState<"english" | "hinglish">("english");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isMinor = birthYear.length === 4 && new Date().getFullYear() - Number(birthYear) < 18;

  // Google accounts come with a name: offer it as the starting value.
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      const fromGoogle = meta.full_name ?? meta.name;
      if (typeof fromGoogle === "string") setName((n) => n || fromGoogle);
    });
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await postJson("/v1/auth/profile", { name, phone, birth_year: Number(birthYear), parental_consent: consent, explain_lang: lang });
      await refresh(); // the app opens once /v1/me works
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <H1>Tell us about you</H1>
      <Muted>We need these once to set up your practice.</Muted>
      <Field label="Your name"><TextInput style={form.input} value={name} onChangeText={setName} autoComplete="name" /></Field>
      <Field label="Mobile number">
        <TextInput style={form.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" placeholderTextColor={C.muted} />
      </Field>
      <Field label="Birth year">
        <TextInput style={form.input} value={birthYear} onChangeText={(t) => setBirthYear(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="2005" placeholderTextColor={C.muted} />
      </Field>
      {isMinor && (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={s.consent}>
          <View style={[s.box, consent && { backgroundColor: C.ink }]} />
          <Body style={{ flex: 1 }}>My parent or guardian agrees to me using this app.</Body>
        </Pressable>
      )}
      <Field label="Explanations in">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Chip text="English" tone={lang === "english" ? "dark" : "white"} onPress={() => setLang("english")} />
          <Chip text="Hinglish" tone={lang === "hinglish" ? "dark" : "white"} onPress={() => setLang("hinglish")} />
        </View>
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button title="Start practising" tone="dark" busy={busy} disabled={!name || !phone || birthYear.length !== 4 || (isMinor && !consent)} onPress={submit} />
      <Button title="Sign out" tone="white" small onPress={() => supabase?.auth.signOut()} />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Body style={{ fontFamily: F.semibold }}>{label}</Body>
      {children}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  consent: { flexDirection: "row", gap: 12, alignItems: "center" },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.ink },
}));
