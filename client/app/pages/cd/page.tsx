"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DeskCd } from "@/components/desk/desk-cd";
import { LoadingBlock } from "@/components/ui/page";
import { isAuthenticated } from "@/lib/auth";

export default function CdPage() {
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
        <LoadingBlock label="Opening CD builder…" />
      </div>
    );
  }

  return <DeskCd />;
}
