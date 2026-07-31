import type { Metadata } from "next";
import { buildPageMetadata } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Convert YouTube to MP3 or MP4",
  description:
    "Paste a YouTube video, playlist, or channel URL into TubeToCD. Preview audio, rename tracks, and download clean MP3 or MP4 files.",
  path: "/pages/convert",
});

export default function ConvertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
