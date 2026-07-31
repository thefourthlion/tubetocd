import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { PageHeader, PageShell } from "@/components/ui/page";
import { buildPageMetadata, siteConfig } from "@/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your data when you convert YouTube links and save a music library.`,
  path: "/pages/privacy",
});

export default function PrivacyPage() {
  return (
    <PageShell width="md">
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description={`How ${siteConfig.name} handles your data at tubetocd.com.`}
      />
      <Panel className="animate-fade-up-delay-1 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">{siteConfig.name}</strong>{" "}
          (“we”, “us”) operates tubetocd.com. This policy explains what we
          collect when you use our YouTube-to-MP3/MP4 desk and how we use it.
        </p>
        <div>
          <h2 className="mb-1.5 font-display text-base font-semibold text-foreground">
            What we collect
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Account details you provide (such as email) when you register.
            </li>
            <li>
              Library data you save — playlists, channels, track metadata, and
              preferences tied to your account.
            </li>
            <li>
              Technical logs needed to run the service (for example request
              timing and error diagnostics). We do not sell personal data.
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-1.5 font-display text-base font-semibold text-foreground">
            How we use it
          </h2>
          <p>
            To sign you in, sync your library, process conversions you request,
            improve reliability, and respond to support messages. YouTube
            content is fetched on your behalf when you paste a link — we do not
            claim ownership of that media.
          </p>
        </div>
        <div>
          <h2 className="mb-1.5 font-display text-base font-semibold text-foreground">
            Retention &amp; deletion
          </h2>
          <p>
            You can delete saved library items from the desk. To request account
            deletion or a copy of your data, email{" "}
            <a
              className="text-primary underline-offset-2 hover:underline"
              href={`mailto:${siteConfig.supportEmail}`}
            >
              {siteConfig.supportEmail}
            </a>
            .
          </p>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Last updated for {siteConfig.name}. See also our{" "}
          <Link href="/pages/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </Panel>
    </PageShell>
  );
}
