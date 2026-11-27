import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Briefcase, Check, FileUp, Shield } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ActivityInfo } from "@/components/ActivityInfo";
import { Conversation, FixThese, Headline, InterviewReport, Results, type Debrief, type Opening } from "@/components/Speaking";
import { BackButton, Body, Button, Card, Chip, Em, ErrorText, H1, IconTile, Label, Muted, Screen, Title } from "@/components/ui";
import { errorText, postFiles } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C, F, themed } from "@/lib/theme";

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
        {plan && <Chip icon={Briefcase} text={`${left === null ? "Unlimited interviews" : `${left} interview${left === 1 ? "" : "s"} left`}`} />}
      </View>
      <Label>Interview prep</Label>
      <H1>Practise for your{"\n"}<Em style={{ fontSize: 36 }}>interview</Em></H1>
      <Muted style={{ fontSize: 17 }}>Upload your resume for a realistic interview on your own field, skills and projects.</Muted>
      <View style={s.drop}>
        <IconTile icon={FileUp} bg={C.mintSoft} size={66} />
        <Title style={{ fontSize: 18 }}>Upload your resume</Title>
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

      {/* The four kinds of question the interviewer asks (from the API prompt), as on web */}
      <Card style={{ gap: 12 }}>
        <Title>Questions you might get</Title>
        <Muted style={{ fontSize: 13 }}>Written around your own resume.</Muted>
        {[
          { tag: "Introduction", q: "Walk me through your background and why you're applying for this role." },
          { tag: "Your projects and skills", q: "On the project in your resume, what was your own part, and why that approach?" },
          { tag: "Problem-solving", q: "Here's a situation from your field. How would you handle it, step by step?" },
          { tag: "Behavioural", q: "Tell me about a time something failed. What did you do, and what would you change?" },
        ].map((x) => (
          <View key={x.tag} style={s.question}>
            <Chip text={x.tag} tone="grey" style={{ alignSelf: "flex-start" }} />
            <Body style={{ fontSize: 15 }}>“{x.q}”</Body>
          </View>
        ))}
      </Card>
      <Card style={{ gap: 10 }}>
        <Title>Before you start</Title>
        {["A quiet room", "Your microphone works", "Your resume as a PDF", "About 15 minutes free"].map((t) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.tick}><Check size={12} color={C.onMint} strokeWidth={3} /></View>
            <Body style={{ fontSize: 15 }}>{t}</Body>
          </View>
        ))}
      </Card>
      <ActivityInfo kind="roleplay" stats={false} tips={["Use a PDF that has selectable text, not a scan.", "Answer with real examples from your projects.", "If a question is unclear, ask the interviewer to repeat it.", "Finish to get feedback on your answers and your English."]} />
    </Screen>
  );
}

const s = themed(() => StyleSheet.create({
  question: { backgroundColor: C.bg, borderRadius: 14, padding: 12, gap: 8 },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  drop: { borderWidth: 2, borderStyle: "dashed", borderColor: C.absent, borderRadius: 22, backgroundColor: C.surface, padding: 28, alignItems: "center", gap: 12 },
  num: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: F.bold, color: C.onInk, fontSize: 16 },
}));
