"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingBlock } from "@/components/ui/page";

/** Search now lives on the desk; keep the old route working. */
function SearchRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    router.replace(q ? `/home?q=${encodeURIComponent(q)}` : "/home");
  }, [router, searchParams]);

  return (
    <div className="p-2 sm:p-3">
      <LoadingBlock label="Opening search…" />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="p-2 sm:p-3">
          <LoadingBlock label="Opening search…" />
        </div>
      }
    >
      <SearchRedirect />
    </Suspense>
  );
}
