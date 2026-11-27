import { History, Lightbulb, Mic, Trophy } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { ago } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { C, F, themed } from "@/lib/theme";
import { Card, Muted } from "./ui";

/**
 * Bottom of an activity's start screen: your stats for it, speaking time left today, and tips.
 * The mobile twin of the web side panel (apps/web/src/components/ActivityAside.tsx).
 */
export function ActivityInfo({ kind, tips, speaking = true, stats = true }: { kind: string; tips: string[]; speaking?: boolean; stats?: boolean }) {
  const { me } = useSession();
  const mine = me?.activities.filter((a) => a.kind === kind) ?? [];
  const best = me?.best[kind];
  const left = me ? Math.round(Math.max(0, me.speaking_limit_seconds - me.speaking_seconds_today) / 60) : 0;
  const limit = me ? Math.round(me.speaking_limit_seconds / 60) : 0;

  return (
    <View style={{ gap: 12 }}>
      {stats && me && (
        <Card style={{ gap: 12 }}>
          <Head icon={Trophy} title="Your stats" />
          {best === undefined ? (
            <Muted style={{ fontSize: 13 }}>No score yet. Your first try sets your best.</Muted>
          ) : (
            <View style={{ gap: 6 }}>
              <View style={s.between}>
                <Muted style={{ fontSize: 13 }}>Best score</Muted>
                <Text style={s.big}>{Math.round(best)}<Text style={s.small}> / 100</Text></Text>
              </View>
              <Bar pct={best} />
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={s.tile}><Muted style={{ fontSize: 11 }}>Sessions</Muted><Text style={s.tileValue}>{mine.length}</Text></View>
            <View style={s.tile}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><History size={11} color={C.muted} /><Muted style={{ fontSize: 11 }}>Last played</Muted></View>
              <Text style={s.tileValue} numberOfLines={1}>{mine[0] ? ago(mine[0].created_at) : "Never"}</Text>
            </View>
          </View>
        </Card>
      )}

      {speaking && me && (
        <Card style={{ gap: 10 }}>
          <View style={s.between}>
            <Head icon={Mic} title="Speaking today" />
            <Text style={[s.badge, left === 0 && { color: C.redText }]}>{left} of {limit} min left</Text>
          </View>
          <Bar pct={limit ? (left / limit) * 100 : 0} />
        </Card>
      )}

      <Card style={{ gap: 10 }}>
        <Head icon={Lightbulb} title="Tips" color={C.purple} />
        {tips.map((t) => (
          <View key={t} style={{ flexDirection: "row", gap: 8 }}>
            <View style={s.bullet} />
            <Muted style={{ flex: 1, fontSize: 13 }}>{t}</Muted>
          </View>
        ))}
      </Card>
    </View>
  );
}

function Head({ icon: I, title, color = C.progress }: { icon: typeof Trophy; title: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <I size={16} color={color} />
      <Text style={s.title}>{title}</Text>
    </View>
  );
}

const Bar = ({ pct }: { pct: number }) => <View style={s.track}><View style={[s.fill, { width: `${Math.max(0, Math.min(100, pct))}%` }]} /></View>;

const s = themed(() => StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  big: { fontFamily: F.extrabold, fontSize: 20, color: C.ink },
  small: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  tile: { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10, gap: 2 },
  tileValue: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  badge: { fontFamily: F.semibold, fontSize: 12, color: C.muted },
  track: { height: 7, borderRadius: 4, backgroundColor: C.grey, overflow: "hidden" },
  fill: { height: 7, borderRadius: 4, backgroundColor: C.progress },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.mint, marginTop: 6 },
}));
