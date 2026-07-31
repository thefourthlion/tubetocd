"use client";

import { PageHeader, PageShell } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";

export default function TestPage() {
  return (
    <PageShell width="sm">
      <PageHeader title="Test" description="Dev stub." />
      <Panel>
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      </Panel>
    </PageShell>
  );
}
