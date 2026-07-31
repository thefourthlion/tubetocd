import type { Metadata } from "next";
import { buildPageMetadata } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Music desk",
  description:
    "Search YouTube, convert to MP3 or MP4, and manage your TubeToCD library from one music desk.",
  path: "/home",
  noIndex: true,
});

export default function HomeDeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
