import type { Metadata } from "next";
import { buildPageMetadata } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Test",
  path: "/pages/test",
  noIndex: true,
});

export default function TestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
