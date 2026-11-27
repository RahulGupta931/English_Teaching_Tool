"use client"; // Error boundaries must be client components

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { ButtonLink, Page } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown instead of a page that crashed while rendering; the nav stays usable around it. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page className="max-w-lg">
      <Card role="alert">
        <CardHeader>
          <span className="mb-2 grid size-12 place-items-center rounded-xl bg-danger/15 text-danger-fg"><TriangleAlert size={24} aria-hidden /></span>
          <CardTitle className="text-2xl">This page didn&apos;t load</CardTitle>
          <CardDescription>Something went wrong on our side. Try again, or go back home. Your progress is saved.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => retry()}><RotateCcw />Try again</Button>
          <ButtonLink href="/" variant="ghost">Back to home</ButtonLink>
        </CardContent>
      </Card>
    </Page>
  );
}
