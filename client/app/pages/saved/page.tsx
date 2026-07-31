"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DeskLibrary } from "@/components/desk/desk-library";
import { LoadingBlock } from "@/components/ui/page";
import { isAuthenticated } from "@/lib/auth";

export default function SavedPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/pages/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="p-2 sm:p-3">
        <LoadingBlock label="Opening library…" />
      </div>
    );
  }

  return <DeskLibrary />;
}
