import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { PageHeader, PageShell } from "@/components/ui/page";
import { buildPageMetadata, siteConfig } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description: `Terms for using ${siteConfig.name} — YouTube to MP3/MP4 conversion, library storage, and acceptable use at tubetocd.com.`,
  path: "/pages/terms",
});

export default function TermsPage() {
  return (
    <PageShell width="md">
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description={`The ground rules for using ${siteConfig.name}.`}
      />
      <Panel className="animate-fade-up-delay-1 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          By using <strong className="text-foreground">{siteConfig.name}</strong>{" "}
          at tubetocd.com you agree to these terms. If you do not agree, do not
          use the service.
        </p>
        <div>
          <h2 className="mb-1.5 font-display text-base font-semibold text-foreground">
            The service
          </h2>
          <p>
            TubeToCD lets you paste YouTube links, preview audio, and download
            MP3 or MP4 files, optionally saving a personal library. Features may
            change as we improve the desk.
          </p>
        </div>
        <div>
          <h2 className="mb-1.5 font-display text-base font-semibold text-foreground">
            Your responsibilities
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Only convert and download content you have the right to use under
              applicable law and YouTube’s terms.
            </li>
            <li>
              Do not abuse the service (scraping at scale, attacking
              infrastructure, or circumventing limits).
            </li>
            <li>
              Keep your account credentials secure and provide accurate signup
              details.
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-1.5 font-display text-base font-semibold text-foreground">
            Disclaimer
          </h2>
          <p>
            The service is provided “as is.” We are not liable for lost files,
            downtime, or third-party content. YouTube and related trademarks
            belong to their owners; TubeToCD is an independent tool.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Questions?{" "}
          <Link href="/pages/contact" className="text-primary hover:underline">
            Contact us
          </Link>{" "}
          or read the{" "}
          <Link href="/pages/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Panel>
    </PageShell>
  );
}
