import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ButtonLink, Page } from "@/components/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <Page className="max-w-lg">
      <Card>
        <CardHeader>
          <span className="mb-2 grid size-12 place-items-center rounded-xl bg-mint/20 text-accent-fg"><Compass size={24} aria-hidden /></span>
          <CardTitle className="text-2xl">We couldn&apos;t find that page</CardTitle>
          <CardDescription>The link may be old or mistyped. Everything to practise is on Home and Practice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/practice" variant="ghost">See all practice</ButtonLink>
        </CardContent>
      </Card>
    </Page>
  );
}
