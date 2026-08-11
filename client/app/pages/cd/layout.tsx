import type { Metadata } from "next";
import { buildPageMetadata } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Make a CD",
  description:
    "Build a custom CD tracklist that fits your blank disc, then download one MP3 zip ready to burn.",
  path: "/pages/cd",
  noIndex: true,
});

export default function CdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
