import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Mic } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Em, ErrorText, Muted } from "@/components/ui";
import { signInWithGoogle } from "@/lib/google";
import { errorText } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { C, F, themed } from "@/lib/theme";

export default function Welcome() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(supabase ? "" : "Sign-in isn't set up. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.");

  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={[C.green, C.green2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={s.hero}>
          <View style={s.blob}>
            <View style={[s.bubble, { top: 30, left: -50 }]}><Text style={s.bubbleText}>“I am a student”</Text></View>
            <Mic size={46} color={C.ink} strokeWidth={2} />
            <View style={[s.bubble, { bottom: 18, right: -50, backgroundColor: C.mint }]}><Text style={[s.bubbleText, { color: C.onMint }]}>+40 XP</Text></View>
          </View>
          <Text style={s.title}>Speak English{"\n"}with <Em style={{ color: C.mint, fontSize: 43 }}>confidence</Em></Text>
          <Text style={s.sub}>Talk with an AI partner, get instant spoken feedback, and play a word game every day.</Text>
        </View>
      </SafeAreaView>
      <SafeAreaView edges={["bottom"]} style={s.sheet}>
        <Button title="Continue with Google" tone="dark" onPress={google} busy={busy} disabled={!supabase} />
        <Button title="Continue with email" tone="outline" onPress={() => router.push({ pathname: "/sign-in", params: { mode: "signup" } })} disabled={!supabase} />
        <ErrorText>{error}</ErrorText>
        <Text style={s.have} onPress={() => supabase && router.push("/sign-in")}>
          Already have an account? <Text style={{ fontFamily: F.bold, color: C.green2 }}>Sign in</Text>
        </Text>
        <Muted style={{ textAlign: "center", fontSize: 14 }}>Your recordings are scored and then deleted.</Muted>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = themed(() => StyleSheet.create({
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 22 },
  blob: { width: 200, height: 200, borderRadius: 100, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  bubble: { position: "absolute", backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  bubbleText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  title: { fontFamily: F.extrabold, fontSize: 36, lineHeight: 43, letterSpacing: -1.2, color: C.onDark, textAlign: "center" },
  sub: { fontFamily: F.regular, fontSize: 17, lineHeight: 20, color: C.onDarkMuted, textAlign: "center" },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 22, gap: 14 },
  have: { fontFamily: F.regular, fontSize: 16, color: C.muted, textAlign: "center" },
}));
