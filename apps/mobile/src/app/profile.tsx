import { Calendar, Check, Phone, ShieldCheck, User, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from "react-native";
import { Button, Card, ErrorText, H1, Muted, Screen } from "@/components/ui";
import { errorText, postJson } from "@/lib/api";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { C, F, themed } from "@/lib/theme";

// Same rules the API applies (apps/api/app/users.py), checked here so mistakes show before sending.
const NAME_OK = /^\p{L}[\p{L}\p{M} .'-]{1,39}$/u;
const PHONE_OK = (raw: string) => {
  const n = raw.replace(/[\s().-]/g, "");
  return /^(\+?91|0)?[6-9]\d{9}$/.test(n) || /^\+[1-9]\d{7,14}$/.test(n);
};

/** Shown once after the first sign-in: details the API needs that Google and email sign-up don't give us. */
export default function Profile() {
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [consent, setConsent] = useState(false);
  const [lang, setLang] = useState<"english" | "hinglish">("english");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState("");
  const phoneRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const yearRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const year = new Date().getFullYear();
  const age = birthYear.length === 4 ? year - Number(birthYear) : null;
  const isMinor = age !== null && age < 18;
  const problems = {
    name: NAME_OK.test(name.trim()) ? "" : "2-40 letters, spaces, dots, dashes or apostrophes.",
    phone: PHONE_OK(phone) ? "" : "Enter a 10-digit mobile number, or start with your country code, e.g. +44.",
    birthYear: age !== null && age >= 6 && age <= 100 ? "" : "Enter the year you were born, e.g. 2004.",
  };
  const ready = !problems.name && !problems.phone && !problems.birthYear && (!isMinor || consent);
  const show = (k: keyof typeof problems) => (touched[k] ? problems[k] : "");
  // Focus styling for a field; leaving it marks it touched so its error can show.
  const focus = (k: string) => ({
    onFocus: () => setFocused(k),
    onBlur: () => { setFocused(""); setTouched((t) => ({ ...t, [k]: true })); },
  });

  // Google accounts come with a name: offer it as the starting value. The email shows which account this is.
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      const fromGoogle = meta.full_name ?? meta.name;
      if (typeof fromGoogle === "string") setName((n) => n || fromGoogle);
      setEmail(data.user?.email ?? "");
    });
  }, []);

  async function submit() {
    setTouched({ name: true, phone: true, birthYear: true });
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/v1/auth/profile", { name: name.trim(), phone, birth_year: Number(birthYear), parental_consent: consent, explain_lang: lang });
      await refresh(); // the app opens once /v1/me works
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Screen scroll style={{ gap: 20, paddingBottom: 24 }} footer={
      <View style={{ flex: 1, gap: 10 }}>
        <ErrorText>{error}</ErrorText>
        <Button title="Start learning" tone="mint" busy={busy} disabled={busy || (Object.keys(touched).length > 0 && !ready)} onPress={submit} />
        <Text style={s.footnote}>
          {email ? <>Signed in as <Text style={s.bold}>{email}</Text> · </> : null}
          <Text style={s.link} accessibilityRole="button" onPress={() => supabase?.auth.signOut()}>Switch account</Text>
        </Text>
      </View>
    }>
      <View style={{ gap: 8, marginTop: 12 }}>
        <View style={s.steps} accessibilityLabel="Step 2 of 2">
          <View style={[s.step, { backgroundColor: C.mint }]} />
          <View style={[s.step, { backgroundColor: C.mint }]} />
        </View>
        <Text style={s.eyebrow}>STEP 2 OF 2</Text>
        <H1 style={{ fontSize: 28 }}>Tell us about you</H1>
        <Muted>We ask once, to set up your practice and keep your account safe.</Muted>
      </View>

      <Card style={{ gap: 16 }}>
        <Field icon={User} label="Your name" error={show("name")} focused={focused === "name"}>
          <TextInput style={s.input} value={name} onChangeText={setName} {...focus("name")}
            returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} submitBehavior="submit"
            autoComplete="name" autoCapitalize="words" maxLength={40} placeholder="e.g. Priya Sharma" placeholderTextColor={C.muted} accessibilityLabel="Your name" />
        </Field>

        <Field icon={Phone} label="Mobile number" error={show("phone")} focused={focused === "phone"} hint="One account per number. Outside India, start with your country code, e.g. +44.">
          <TextInput ref={phoneRef} style={s.input} value={phone} onChangeText={setPhone} {...focus("phone")}
            returnKeyType="next" onSubmitEditing={() => yearRef.current?.focus()} submitBehavior="submit"
            keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" placeholderTextColor={C.muted} accessibilityLabel="Mobile number" />
        </Field>

        <Field icon={Calendar} label="Birth year" error={show("birthYear")} focused={focused === "birthYear"}>
          <TextInput ref={yearRef} style={s.input} value={birthYear} onChangeText={(t) => setBirthYear(t.replace(/\D/g, "").slice(0, 4))}
            {...focus("birthYear")} returnKeyType="done" onSubmitEditing={submit} keyboardType="number-pad" autoComplete="birthdate-year"
            placeholder="e.g. 2004" placeholderTextColor={C.muted} accessibilityLabel="Birth year" />
        </Field>

        {isMinor && (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={s.consent}>
            <View style={[s.box, consent && s.boxOn]}>{consent && <Check size={14} color={C.onMint} strokeWidth={3} />}</View>
            <Text style={s.consentText}>
              I am a parent or guardian and I agree to this learner using the app, including voice recordings that are scored and then deleted.
            </Text>
          </Pressable>
        )}

        <View style={{ gap: 8 }}>
          <View style={s.between}>
            <Text style={s.label}>Explanations in</Text>
            <Muted style={{ fontSize: 12 }}>Change any time in Settings</Muted>
          </View>
          <View style={s.segment}>
            {(["english", "hinglish"] as const).map((l) => (
              <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: lang === l }} onPress={() => setLang(l)}
                style={[s.segItem, lang === l && s.segOn]}>
                <Text style={[s.segText, lang === l && { color: C.ink }]}>{l === "english" ? "English" : "Hinglish"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      <View style={s.trust}>
        <ShieldCheck size={16} color={C.muted} />
        <Muted style={{ fontSize: 12, flex: 1 }}>Your number is only used for your account. Recordings are scored and then deleted.</Muted>
      </View>
    </Screen>
  );
}

function Field({ icon: I, label, hint, error, focused, children }: { icon: LucideIcon; label: string; hint?: string; error?: string; focused?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputRow, focused && s.inputFocused, !!error && { borderColor: C.redText }]}>
        <I size={18} color={focused ? C.progress : C.muted} />
        {children}
      </View>
      {error ? <Text style={s.bad}>{error}</Text> : hint ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  steps: { flexDirection: "row", gap: 6, marginBottom: 6 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  eyebrow: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1, color: C.progress },
  label: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.bg },
  inputFocused: { borderColor: C.progress },
  // The row shows focus, so the browser's own outline inside it is dropped on web.
  input: { flex: 1, minHeight: 48, fontFamily: F.medium, fontSize: 16, color: C.ink, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null) },
  bad: { fontFamily: F.medium, fontSize: 12, color: C.redText },
  consent: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: C.bg, borderRadius: 14, padding: 14 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: C.ink, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { backgroundColor: C.mint, borderColor: C.mint },
  consentText: { flex: 1, fontFamily: F.regular, fontSize: 13, lineHeight: 19, color: C.ink },
  segment: { alignSelf: "flex-start", flexDirection: "row", backgroundColor: C.grey, borderRadius: 999, padding: 4 },
  segItem: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  segOn: { backgroundColor: C.bg },
  segText: { fontFamily: F.semibold, fontSize: 14, color: C.muted },
  bold: { fontFamily: F.bold, color: C.ink },
  link: { fontFamily: F.bold, fontSize: 13, color: C.blue },
  trust: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footnote: { fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: "center" },
}));
