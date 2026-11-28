"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookX, Globe, GraduationCap, LogOut, Sparkles, type LucideIcon } from "lucide-react";
import { MistakeList } from "@/components/Results";
import { ButtonLink, IconTile, Page, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api, ApiError, errorText, getMe, signOut, useRequireLogin, type Mistake, type User } from "@/lib/api";
import { setTheme, useTheme } from "@/lib/theme";

type Me = { user: User; mistakes: Mistake[] };

/** Moved here from Me: recent mistakes, upgrade plan, explanation language, appearance and sign out. */
export default function SettingsPage() {
  useRequireLogin();
  const router = useRouter();
  const theme = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMe<Me>()
      .then(setMe)
      // 428: profile not filled in yet; Home shows the profile form.
      .catch((e) => (e instanceof ApiError && e.status === 428 ? router.replace("/") : setMessage(errorText(e))));
  }, [router]);

  async function changeLanguage(explain_lang: string) {
    try {
      const user = await api<User>("/v1/me", { method: "PATCH", body: JSON.stringify({ explain_lang }) });
      setMe((m) => (m ? { ...m, user } : m));
    } catch (e) {
      setMessage(errorText(e));
    }
  }

  if (!me) {
    return (
      <Page aria-busy={!message}>
        {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-64 rounded-card" />
      </Page>
    );
  }

  const { user } = me;
  const mistakeCount = new Set(me.mistakes.map((m) => m.original.toLowerCase())).size;

  return (
    <Page>
      <PageHeader title="Settings" />

      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
          {mistakeCount > 0 && (
            <Card aria-labelledby="mistakes-heading">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle id="mistakes-heading" className="flex items-center gap-2"><BookX className="size-5 text-accent-fg" aria-hidden />Mistakes to review</CardTitle>
                  <Link href="/mistakes" className="text-sm font-semibold text-link hover:underline">See all {mistakeCount}</Link>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <MistakeList mistakes={me.mistakes.slice(0, 2)} />
                <ButtonLink href="/coach" variant="ghost" icon={GraduationCap} className="self-start">Fix them with Mistake Coach</ButtonLink>
              </CardContent>
            </Card>
          )}

          <Card aria-labelledby="settings-heading">
            <CardHeader><CardTitle id="settings-heading">Preferences</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Setting icon={Globe} title="Explanations in" meta="Language for tips and corrections">
                <Segmented label="Explanations in" value={user.explain_lang} onChange={changeLanguage}
                  options={[{ value: "english", label: "English" }, { value: "hinglish", label: "Hinglish" }]} />
              </Setting>
              <Separator />
              <Setting icon={Sparkles} title="Appearance" meta="Day or night colours">
                <Segmented label="Appearance" value={theme} onChange={setTheme}
                  options={[{ value: "day", label: "Day" }, { value: "night", label: "Night" }]} />
              </Setting>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
          <Card aria-labelledby="plan-heading">
            <CardHeader><CardTitle id="plan-heading">Plan</CardTitle></CardHeader>
            <CardContent>
              <ButtonLink href="/plans" variant="coral" icon={Sparkles} className="self-start">Upgrade your practice</ButtonLink>
            </CardContent>
          </Card>

          <Card aria-labelledby="account-heading">
            <CardHeader><CardTitle id="account-heading">Account</CardTitle></CardHeader>
            <CardContent>
              <Button variant="secondary" onClick={() => signOut()}><LogOut />Sign out</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <p role="alert" className="text-sm text-danger-fg empty:hidden">{message}</p>
    </Page>
  );
}

function Setting({ icon, title, meta, children }: { icon: LucideIcon; title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} size={36} />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-fg-3">{meta}</span>
        </div>
      </div>
      <div className="pl-12">{children}</div>
    </div>
  );
}
