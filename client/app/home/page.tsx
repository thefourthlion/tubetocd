"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DeskSearch } from "@/components/desk/desk-search";
import { LoadingBlock } from "@/components/ui/page";
import { isAuthenticated } from "@/lib/auth";

export default function AppHomePage() {
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
        <LoadingBlock label="Opening desk…" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="p-2 sm:p-3">
          <LoadingBlock label="Opening desk…" />
        </div>
      }
    >
      <DeskSearch />
    </Suspense>
  );
}
