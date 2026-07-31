"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Footer from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { DeskFrame } from "@/components/shell/DeskFrame";
import { NowPlayingBar } from "@/components/shell/NowPlayingBar";
import { isAuthenticated } from "@/lib/auth";

/** Routes that stay outside the signed-in desk even when a session exists. */
const PUBLIC_ONLY = [
  "/pages/login",
  "/pages/register",
  "/pages/privacy",
  "/pages/terms",
  "/pages/contact",
];

export function ShellGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    sync();
    setReady(true);
    window.addEventListener("storage", sync);
    window.addEventListener("auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-changed", sync);
    };
  }, []);

  const isLanding = pathname === "/";
  const forcePublic = PUBLIC_ONLY.some((path) => pathname.startsWith(path));

  if (!ready) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center font-mono text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  // The landing page is the only marketing surface.
  if (isLanding) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col text-foreground safe-area-insets">
        <Navbar />
        <main className="container mx-auto w-full max-w-7xl flex-grow px-4 pb-10 pt-2 sm:px-6 sm:pt-4">
          {children}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <DeskFrame variant={authed && !forcePublic ? "app" : "plain"}>
        {children}
      </DeskFrame>
      <NowPlayingBar />
    </>
  );
}
