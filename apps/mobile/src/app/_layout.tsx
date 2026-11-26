import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Loading } from "@/components/ui";
import { SessionProvider, useSession } from "@/lib/session";
import { C } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function Root() {
  const [fonts] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, InstrumentSerif_400Regular_Italic,
  });
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Gate fonts={fonts} />
    </SessionProvider>
  );
}

/** Signed out -> welcome; signed in without a profile -> profile form; otherwise the app. */
function Gate({ fonts }: { fonts: boolean }) {
  const { session, me, needsProfile, error, refresh } = useSession();
  const signedIn = !!session;
  const loaded = fonts && session !== undefined && (!signedIn || !!me || needsProfile || !!error);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;
  if (signedIn && !me && !needsProfile) return <Loading error={error} onRetry={refresh} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && needsProfile}>
        <Stack.Screen name="profile" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !!me}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="roleplay" />
        <Stack.Screen name="interview" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="jam" />
        <Stack.Screen name="daily-word" />
        <Stack.Screen name="word-chain" />
        <Stack.Screen name="tongue-twister" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="placement" />
      </Stack.Protected>
      <Stack.Screen name="auth-callback" />
    </Stack>
  );
}
