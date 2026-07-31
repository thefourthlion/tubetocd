import { Suspense } from "react";
import PlaylistDetailClient from "./playlist-detail-client";
import { LoadingBlock, PageShell } from "@/components/ui/page";

export default function PlaylistDetailPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <LoadingBlock label="Loading playlist…" />
        </PageShell>
      }
    >
      <PlaylistDetailClient />
    </Suspense>
  );
}
