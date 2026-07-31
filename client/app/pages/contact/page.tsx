import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page";
import { buildPageMetadata, siteConfig } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description: `Get help with ${siteConfig.name} — YouTube to MP3/MP4 conversion, library sync, and account support at tubetocd.com.`,
  path: "/pages/contact",
});

export default function ContactPage() {
  return (
    <PageShell width="md">
      <PageHeader
        eyebrow="Support"
        title="Contact"
        description="We’re here if a convert stalls or your library needs a hand."
      />
      <Panel className="animate-fade-up-delay-1">
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Email the TubeToCD team and include the link you were converting (if
          relevant) plus what you expected to happen. We read every message.
        </p>
        <p className="mb-6 font-mono text-sm text-foreground">
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {siteConfig.supportEmail}
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:${siteConfig.supportEmail}`}>
            <Button size="sm">Send email</Button>
          </a>
          <Link href="/">
            <Button variant="outline" size="sm">
              Back home
            </Button>
          </Link>
        </div>
      </Panel>
    </PageShell>
  );
}
