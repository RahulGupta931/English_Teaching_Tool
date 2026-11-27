"use client";

import { useEffect, useState } from "react";
import { errorText, finishPasswordRecovery, postJson } from "@/lib/api";
import { authConfigured, supabase } from "@/lib/supabase";
import { ArrowRight, Eye, EyeOff, Globe, LoaderCircle, ShieldCheck } from "lucide-react";
import { Page, Segmented } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const MIN_PASSWORD = 8;
const home = () => window.location.origin;

/** Google, or email + password: sign in, create an account, or reset a forgotten password. */
export function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string | void>) {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const done = await action();
      if (done) setMessage(done);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const google = () =>
    run(async () => {
      const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: home() } });
      if (error) throw error; // on success the browser leaves for Google
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      if (mode === "forgot") {
        const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: home() });
        if (error) throw error;
        return "If that email has an account, we've sent a link to reset the password.";
      }
      if (mode === "signup") {
        const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: home() } });
        if (error) throw error;
        if (!data.session) return "Check your inbox and click the link to confirm your email. Then sign in here.";
        return;
      }
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw error;
    });
  }

  if (!authConfigured) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign-in isn&apos;t set up</CardTitle>
          <CardDescription>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to apps/web/.env.local and restart the web app.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in";
  return (
    <Card className="w-full max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {mode !== "forgot" && <CardDescription>Free to start. No card needed.</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mode !== "forgot" && (
            <>
              <Button type="button" variant="secondary" onClick={google} disabled={busy}><Globe />Continue with Google</Button>
              <div className="flex items-center gap-3 text-xs text-fg-3"><Separator className="flex-1" />or use your email<Separator className="flex-1" /></div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
          </div>
          {mode !== "forgot" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && <button type="button" onClick={() => setMode("forgot")} className="cursor-pointer text-xs font-medium text-link hover:underline">Forgot password?</button>}
              </div>
              <PasswordInput id="password" value={password} onChange={setPassword} minLength={mode === "signup" ? MIN_PASSWORD : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {mode === "signup" && <span className="text-xs text-fg-2">At least {MIN_PASSWORD} characters</span>}
            </div>
          )}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? <><LoaderCircle className="animate-spin" />Please wait…</> :
              mode === "signup" ? <>Create account <ArrowRight /></> :
              mode === "forgot" ? <>Send reset link</> : <>Sign in <ArrowRight /></>}
          </Button>
          <p role="status" aria-live="polite" className="text-sm font-medium text-[var(--good)] empty:hidden">{message}</p>
          <p role="alert" className="text-sm text-danger-fg empty:hidden">{error}</p>
        </CardContent>
        <CardFooter className="flex-col gap-3 border-t border-line pt-(--card-spacing)">
          {mode === "signin" ? (
            <p className="text-sm text-fg-2">New here? <button type="button" onClick={() => setMode("signup")} className="cursor-pointer font-semibold text-link hover:underline">Create an account</button></p>
          ) : (
            <button type="button" onClick={() => setMode("signin")} className="cursor-pointer text-sm font-semibold text-link hover:underline">Back to sign in</button>
          )}
          <p className="flex items-center gap-2 text-xs text-fg-3"><ShieldCheck size={14} aria-hidden />Your recordings are scored and then deleted. They are never stored.</p>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Password field with a show/hide button. */
function PasswordInput({ id, value, onChange, minLength, autoComplete }: { id: string; value: string; onChange: (v: string) => void; minLength?: number; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} required minLength={minLength} autoComplete={autoComplete} className="pr-11" />
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-2">
        {show ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

/** Shown once after the first sign-in: details we need that Google and email sign-up don't give us. */
export function ProfileForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [consent, setConsent] = useState(false);
  const [explainLang, setExplainLang] = useState("english");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isMinor = birthYear.length === 4 && new Date().getFullYear() - Number(birthYear) < 18;

  // Google accounts come with a name: offer it as the starting value.
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      const fromGoogle = meta.full_name ?? meta.name;
      if (typeof fromGoogle === "string") setName((n) => n || fromGoogle);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await postJson("/v1/auth/profile", {
        name,
        phone,
        birth_year: Number(birthYear),
        parental_consent: consent,
        explain_lang: explainLang,
      });
      onDone();
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page className="max-w-lg">
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
          <CardHeader>
            <span className="text-xs font-semibold tracking-wider text-accent-fg uppercase">One last step</span>
            <CardTitle className="text-2xl">Tell us about you</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" placeholder="98765 43210" aria-describedby="phone-hint" />
              <span id="phone-hint" className="text-xs text-fg-2">One account per number. Outside India, start with your country code, e.g. +44.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birth-year">Birth year</Label>
              <Input id="birth-year" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} required inputMode="numeric" autoComplete="bday-year" placeholder="e.g. 2004" />
            </div>
            {isMinor && (
              <label className="flex items-start gap-3 rounded-tile bg-raised p-4 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ring)]" />
                <span>I am a parent or guardian and I agree to this learner using the app, including voice recordings that are scored and then deleted.</span>
              </label>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">Explanations in</span>
              <Segmented label="Explanations in" value={explainLang} onChange={setExplainLang}
                options={[{ value: "english", label: "English" }, { value: "hinglish", label: "Hinglish" }]} />
            </div>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <><LoaderCircle className="animate-spin" />Please wait…</> : <>Start learning <ArrowRight /></>}
            </Button>
            <p role="alert" className="text-sm text-danger-fg empty:hidden">{message}</p>
          </CardContent>
        </form>
      </Card>
    </Page>
  );
}

/** After following a "reset password" email link. */
export function NewPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else finishPasswordRecovery();
  }

  return (
    <Page className="max-w-md">
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
          <CardHeader><CardTitle className="text-2xl">Choose a new password</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput id="new-password" value={password} onChange={setPassword} minLength={MIN_PASSWORD} autoComplete="new-password" />
              <span className="text-xs text-fg-2">At least {MIN_PASSWORD} characters</span>
            </div>
            <Button type="submit" size="lg" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" />Saving…</> : "Save password"}</Button>
            <p role="alert" className="text-sm text-danger-fg empty:hidden">{message}</p>
          </CardContent>
        </form>
      </Card>
    </Page>
  );
}
