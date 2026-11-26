import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Briefcase, FileUp, Shield } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Conversation, FixThese, Headline, InterviewReport, Results, type Debrief, type Opening } from "@/components/Speaking";
import { BackButton, Body, Button, Card, Chip, Em, ErrorText, H1, IconTile, Label, Muted, Screen, Title } from "@/components/ui";
import { errorText, postFiles } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

const MAX_BYTES = 2_000_000;

export default function Interview() {
  const { me, refresh } = useSession();
  const [opening, setOpening] = useState<Opening | null>(null);
  const [report, setReport] = useState<Debrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick() {
    setError("");
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (res.canceled) return;
    const file = res.assets[0];
    if (file.size && file.size > MAX_BYTES) return setError("That file is too big (max 2 MB).");
    setBusy(true);
    try {
      // Reading the resume and writing the first question takes a few seconds.
      setOpening(await postFiles<Opening>("/v1/roleplay/resume", { resume: { uri: file.uri, name: file.name || "resume.pdf", type: "application/pdf" } }));
      refresh(); // one interview used
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const again = () => {
    setOpening(null);
    setReport(null);
  };
  if (report?.interview) return <InterviewReport d={report} onAgain={again} />;
  if (report) {
    return (
      <Results score={report.score} xp={report.xp} summary={report.summary} onAgain={again} headline={<Headline before="Good" em="interview" after="" />}>
        <FixThese mistakes={report.mistakes} phrases={report.better_phrases} />
      </Results>
    );
  }
  if (opening) return <Conversation base="/v1/roleplay" opening={opening} title="Job Interview" subtitle="From your resume" partner="Interviewer" onFinished={setReport} />;

  const plan = me?.user.plan;
  const left = plan?.interviews_left;
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <BackButton />
        {plan && <Chip icon={Briefcase} text={`${plan.name} plan · ${left === null ? "unlimited interviews" : `${left} interview${left === 1 ? "" : "s"} left`}`} />}
      </View>
      <Label>Interview prep</Label>
      <H1>Practise for your{"\n"}<Em style={{ fontSize: 44 }}>interview</Em></H1>
      <Muted style={{ fontSize: 17 }}>Upload your resume for a realistic interview on your own field, skills and projects.</Muted>
      <View style={s.drop}>
        <IconTile icon={FileUp} bg={C.mintSoft} size={84} />
        <Title style={{ fontSize: 22 }}>Upload your resume</Title>
        <Muted style={{ textAlign: "center" }}>PDF, up to 2 MB. Scanned resumes aren&apos;t supported yet.</Muted>
        <Button title={busy ? "Reading your resume…" : "Choose PDF"} small busy={busy} disabled={left === 0} onPress={pick} style={{ minWidth: 180 }} />
      </View>
      <ErrorText>{error || (left === 0 ? "You've used all your interviews. Get a plan to practise more." : "")}</ErrorText>
      {left === 0 && <Button title="See plans" tone="dark" small onPress={() => router.navigate("/me")} />}
      <Card style={{ gap: 14 }}>
        <Title>What to expect</Title>
        {["In-depth questions on your field, skills and projects", "Follow-up questions when an answer is vague", "Feedback on your answers and your English"].map((t, i) => (
          <View key={t} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <View style={s.num}><Text style={s.numText}>{i + 1}</Text></View>
            <Body style={{ flex: 1, fontSize: 17 }}>{t}</Body>
          </View>
        ))}
      </Card>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Shield size={20} color={C.muted} />
        <Muted style={{ flex: 1, fontSize: 14 }}>Your resume is read once and then deleted. Only a short summary is kept for the interview.</Muted>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  drop: { borderWidth: 2, borderStyle: "dashed", borderColor: "#B9C8C0", borderRadius: 32, backgroundColor: "#fff", padding: 28, alignItems: "center", gap: 12 },
  num: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: F.bold, color: "#fff", fontSize: 16 },
});
