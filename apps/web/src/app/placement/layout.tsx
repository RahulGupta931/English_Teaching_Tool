import type { Metadata } from "next";

// The page is a client component, so its tab title is set here.
export const metadata: Metadata = { title: "Placement Test" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
