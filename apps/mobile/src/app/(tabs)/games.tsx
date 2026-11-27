import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { AudioLines, Check, ChevronRight, LayoutGrid, Link2, type LucideIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TWISTER_LEVEL_KEY } from "@/components/PracticeList";
import { Button, Chip, GreenCard, H1, IconTile, Muted, Screen } from "@/components/ui";
import { doneToday } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { C, F, themed } from "@/lib/theme";

const TWISTER_LEVELS = 15;

/** Games hub: today's Daily Word up top, then each game with where you are in it. */
export default function Games() {
  const { me, refresh } = useSession();
  const [twister, setTwister] = useState(1);
  useFocusEffect(useCallback(() => {
    refresh();
    AsyncStorage.getItem(TWISTER_LEVEL_KEY).then((v) => setTwister(Number(v) || 1)).catch(() => {});
  }, [refresh]));
  if (!me) return null;

  const today = doneToday(me.activities);
  const solved = today.has("daily_word");
  const chainBest = me.best.word_chain;

  return (
    <Screen scroll style={{ paddingBottom: 120, gap: 18 }} onRefresh={refresh}>
      <View style={{ marginTop: 8, gap: 4 }}>
        <H1 style={{ fontSize: 32 }}>Games</H1>
        <Muted>Quick games for new words and clearer speech.</Muted>
      </View>

      <GreenCard style={{ gap: 14 }}>
        <View style={s.between}>
          <IconTile icon={LayoutGrid} bg={C.mint} color={C.onMint} size={44} />
          <Chip text={solved ? "Solved today" : "New word today"} icon={solved ? Check : undefined} tone="glass" />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={s.featureTitle}>Daily Word</Text>
          <Muted style={{ color: C.onDarkMuted }}>
            {solved ? "Nice work. A new word arrives tomorrow; say a sentence with today's word for bonus XP." : "Guess today's five-letter word in six tries. Everyone gets the same word."}
          </Muted>
        </View>
        <Button title={solved ? "See today's word" : "Play now"} tone="mint" onPress={() => router.push("/daily-word")} />
      </GreenCard>

      <Game icon={Link2} title="Word Chain" text="Say a word that starts with the AI's last letter."
        meta={chainBest !== undefined ? `Best score ${chainBest}` : "Not played yet"} onPress={() => router.push("/word-chain")} />
      <Game icon={AudioLines} title="Tongue Twister" text="Listen once, then say it clearly and fast."
        meta={`Level ${twister} of ${TWISTER_LEVELS}`} progress={twister / TWISTER_LEVELS} bg={C.peachSoft} onPress={() => router.push("/tongue-twister")} />
    </Screen>
  );
}

function Game({ icon, title, text, meta, progress, bg, onPress }: {
  icon: LucideIcon; title: string; text: string; meta: string; progress?: number; bg?: string; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`} onPress={onPress}
      style={({ pressed }) => [s.card, { backgroundColor: bg ?? C.surface }, pressed && { opacity: 0.85 }]}>
      <View style={s.between}>
        <IconTile icon={icon} bg={C.bg} size={41} />
        <ChevronRight size={24} color={C.muted} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={s.title}>{title}</Text>
        <Muted>{text}</Muted>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={s.meta}>{meta}</Text>
        {progress !== undefined && <View style={s.track}><View style={[s.fill, { width: `${Math.min(1, progress) * 100}%` }]} /></View>}
      </View>
    </Pressable>
  );
}

const s = themed(() => StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  featureTitle: { fontFamily: F.extrabold, fontSize: 25, letterSpacing: -0.8, color: C.onDark },
  card: { borderRadius: 22, padding: 22, gap: 14 },
  title: { fontFamily: F.bold, fontSize: 18, letterSpacing: -0.4, color: C.ink },
  meta: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: C.grey, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.progress },
}));
