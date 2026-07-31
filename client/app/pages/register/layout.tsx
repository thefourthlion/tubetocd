import type { Metadata } from "next";
import { buildPageMetadata } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Create account",
  description:
    "Create a free TubeToCD account to save playlists, channels, and YouTube downloads to your personal music desk.",
  path: "/pages/register",
});

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
