import { router } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { House, LayoutGrid, Mic, Trophy, User, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F, themed } from "@/lib/theme";

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: "Home", icon: House },
  practice: { label: "Practice", icon: LayoutGrid },
  games: { label: "Games", icon: Trophy },
  me: { label: "Me", icon: User },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="practice" />
      <Tabs.Screen name="games" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

/** Docked bar, same style as the web app's phone bar: active tab in green with a top indicator; the mic in the middle starts a role-play. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const item = (i: number) => {
    const route = state.routes[i];
    const { label, icon: I } = TABS[route.name];
    const active = state.index === i;
    return (
      <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}
        onPress={() => navigateToTab(route.key)} style={s.item}>
        {active && <View style={s.indicator} />}
        <I size={22} color={active ? C.progress : C.muted} strokeWidth={active ? 2.4 : 2} />
        <Text style={[s.label, active && { color: C.ink, fontFamily: F.bold }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {item(0)}
      {item(1)}
      <View style={s.item}>
        <Pressable accessibilityRole="button" accessibilityLabel="Start speaking with the AI partner" onPress={() => router.push("/roleplay")}
          style={({ pressed }) => [s.mic, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Mic size={24} color={C.mint} strokeWidth={2.2} />
        </Pressable>
        <Text style={s.label}>Speak</Text>
      </View>
      {item(2)}
      {item(3)}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end",
    backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 12,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3, minHeight: 48 },
  indicator: { position: "absolute", top: -8, width: 28, height: 3, borderRadius: 2, backgroundColor: C.progress },
  label: { fontFamily: F.medium, fontSize: 11, color: C.muted },
  mic: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: C.green, alignItems: "center", justifyContent: "center", marginTop: -26,
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
}));
