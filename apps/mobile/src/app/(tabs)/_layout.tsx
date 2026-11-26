import { router } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { House, LayoutGrid, Mic, Trophy, User, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F } from "@/lib/theme";

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

/** Floating pill with a raised mic button in the middle (Figma page 1). The mic starts a role-play. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const item = (i: number) => {
    const route = state.routes[i];
    const { label, icon: I } = TABS[route.name];
    const active = state.index === i;
    return (
      <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}
        onPress={() => navigateToTab(route.key)} style={s.item}>
        <View style={[s.iconWrap, active && { backgroundColor: C.mint }]}>
          <I size={24} color={active ? C.ink : C.muted} strokeWidth={2} />
        </View>
        <Text style={[s.label, active && { color: C.ink, fontFamily: F.bold }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={s.bar}>
        {item(0)}
        {item(1)}
        <View style={{ width: 84 }} />
        {item(2)}
        {item(3)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Start speaking with the AI partner"
        onPress={() => router.push("/roleplay")} style={[s.mic, { bottom: Math.max(insets.bottom, 12) + 38 }]}>
        <Mic size={30} color={C.mint} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: "center" },
  bar: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 8, width: "100%",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  item: { flex: 1, alignItems: "center", gap: 4 },
  iconWrap: { width: 58, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  mic: {
    position: "absolute", width: 84, height: 84, borderRadius: 42, backgroundColor: C.green, borderWidth: 5, borderColor: "#EEF2EF",
    alignItems: "center", justifyContent: "center", elevation: 10,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
});
