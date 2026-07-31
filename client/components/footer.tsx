"use client";

import Link from "next/link";
import { Logo } from "@/components/icons";
import { siteConfig } from "@/config/site";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto w-full border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6 sm:pb-8 sm:pt-12">
        <div className="mb-8 grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <Link href="/" className="mb-3 inline-flex items-center gap-2">
              <Logo size={24} />
              <span className="font-display text-base font-bold tracking-tight">
                TubeTo<span className="text-primary">CD</span>
              </span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              {siteConfig.tagline}. Paste a YouTube link, preview audio, and
              download clean MP3 or MP4 files for your collection.
            </p>
            <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground/80">
              tubetocd.com
            </p>
          </div>

          <div>
            <span className="mb-3 block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Product
            </span>
            <ul className="m-0 list-none space-y-2 p-0">
              {siteConfig.footer.product.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="mb-3 block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Legal
            </span>
            <ul className="m-0 list-none space-y-2 p-0">
              {siteConfig.footer.legal.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="mb-3 block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Connect
            </span>
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="inline-flex h-8 items-center rounded-md border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-all duration-200 ease-apple hover:border-primary/35 hover:text-foreground"
              >
                Email
              </a>
              {siteConfig.links.twitter ? (
                <a
                  href={siteConfig.links.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-md border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-all duration-200 ease-apple hover:border-primary/35 hover:text-foreground"
                >
                  X
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 font-mono text-xs text-muted-foreground">
            © {year} {siteConfig.name}
          </p>
          <p className="m-0 text-xs text-muted-foreground/80">
            YouTube to MP3 &amp; MP4 · built for your shelf
          </p>
        </div>
      </div>
    </footer>
  );
}
