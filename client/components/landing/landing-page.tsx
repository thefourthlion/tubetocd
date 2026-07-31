"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Disc3,
  Download,
  FolderOpen,
  Headphones,
  Link2,
  ListMusic,
  Radio,
  Search,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";

function WaveformMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 960 220"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ttcd-wave" x1="0" y1="0" x2="960" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
          <stop offset="45%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <path
        d="M0 120 C40 120 50 40 80 40 S120 200 160 200 S200 50 240 50 S280 170 320 170 S360 30 400 30 S440 190 480 190 S520 60 560 60 S600 160 640 160 S680 45 720 45 S760 175 800 175 S840 90 880 90 S920 120 960 120"
        stroke="url(#ttcd-wave)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M0 120 C50 120 60 75 100 75 S150 155 190 155 S240 85 280 85 S330 145 370 145 S420 70 460 70 S510 150 550 150 S600 95 640 95 S690 140 730 140 S780 100 820 100 S880 120 960 120"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.12"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Paste a Tube link",
    body: "Drop in a YouTube video, playlist, or channel URL — or search from the desk.",
  },
  {
    n: "02",
    title: "Preview & name tracks",
    body: "Listen before you keep it. Fix filenames, pick MP3 or MP4, select what matters.",
  },
  {
    n: "03",
    title: "Press to your collection",
    body: "Download tagged MP3s or direct MP4s — one track or a whole ZIP for your shelf.",
  },
] as const;

const FEATURES = [
  {
    icon: Download,
    title: "Video, playlist, or channel",
    body: "Resolve metadata, rename files, and pull audio or video in one clean pass.",
  },
  {
    icon: ListMusic,
    title: "Batch & ZIP presses",
    body: "Grab whole playlists or channels as a zip instead of clicking one by one.",
  },
  {
    icon: Headphones,
    title: "Preview before you keep it",
    body: "Stream converted audio with a Now Playing bar while you work the desk.",
  },
  {
    icon: FolderOpen,
    title: "Personal music library",
    body: "Save channels, playlists, and tracks. Filter, rate, and re-download anytime.",
  },
  {
    icon: Search,
    title: "YouTube search desk",
    body: "Search YouTube or paste a URL from a signed-in desk built for speed.",
  },
  {
    icon: Tag,
    title: "ID3-tagged MP3s",
    body: "Files land with clean tags so your collection stays organized on day one.",
  },
] as const;

const FORMATS = ["MP3", "MP4"] as const;

function DeskPreview({ className }: { className?: string }) {
  const rows = [
    { title: "Grace", channel: "Jeff Buckley", fmt: "MP3", active: true },
    { title: "Hallelujah", channel: "Jeff Buckley", fmt: "MP3", active: false },
    { title: "Channel · Uploads", channel: "59 tracks", fmt: "ZIP", active: false },
    { title: "Last Goodbye", channel: "Jeff Buckley", fmt: "MP4", active: false },
  ] as const;

  return (
    <div
      className={cn("lw-window wire-glow overflow-hidden", className)}
      aria-hidden
    >
      <div className="lw-titlebar flex items-center gap-2 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
        </span>
        <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          TubeToCD · Music desk
        </span>
      </div>

      <div className="flex gap-1 border-b border-border bg-muted/40 px-2 pt-2">
        {["Search", "Library", "Convert"].map((tab, i) => (
          <span
            key={tab}
            className="lw-tab"
            data-active={i === 0 ? "true" : undefined}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="space-y-3 bg-card p-3 sm:p-4">
        <div className="lw-inset flex items-center gap-2 px-3 py-2">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-xs text-muted-foreground">
            youtube.com/@…/videos
          </span>
          <span className="ml-auto shrink-0 rounded bg-primary/15 px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-accent-foreground">
            Load
          </span>
        </div>

        <div className="lw-inset overflow-hidden">
          <div className="grid grid-cols-[1fr_7rem_5rem] border-b border-border">
            <span className="lw-colhead">Title</span>
            <span className="lw-colhead">Channel</span>
            <span className="lw-colhead">Format</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.title}
              className="lw-row grid grid-cols-[1fr_7rem_5rem] text-xs"
              data-selected={row.active ? "true" : undefined}
            >
              <span className="lw-cell font-medium">{row.title}</span>
              <span className="lw-cell lw-dim text-muted-foreground">
                {row.channel}
              </span>
              <span className="lw-cell font-mono text-[0.65rem]">{row.fmt}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded border border-border/70 bg-muted/30 px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Disc3 size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Grace</p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
              <div className="h-full w-[62%] animate-soft-pulse rounded-full bg-primary" />
            </div>
          </div>
          <span className="font-mono text-[0.6rem] text-muted-foreground">
            5:22
          </span>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    sync();
    window.addEventListener("auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Paste a YouTube link first");
      return;
    }
    router.push(`/pages/convert?url=${encodeURIComponent(trimmed)}`);
  };

  const secondaryHref = authed ? "/home" : "/pages/register";
  const secondaryLabel = authed ? "Open music desk" : "Create a free account";

  return (
    <div className="relative -mx-4 flex flex-col sm:-mx-6">
      {/* Hero — brand first */}
      <section className="relative flex min-h-[calc(100dvh-7.5rem)] flex-col justify-center overflow-hidden px-4 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-[18%] -z-0 flex justify-center"
          aria-hidden
        >
          <WaveformMark className="w-[120%] max-w-5xl animate-soft-pulse opacity-70 dark:opacity-50 sm:w-full" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center text-center">
          <p className="animate-fade-up font-display text-[3.4rem] font-extrabold leading-[0.92] tracking-tight text-foreground sm:text-7xl md:text-8xl">
            TubeTo<span className="text-primary">CD</span>
          </p>

          <h1 className="animate-fade-up-delay-1 mt-5 max-w-xl font-display text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
            YouTube to MP3 &amp; MP4 — pressed for your shelf.
          </h1>

          <p className="animate-fade-up-delay-2 mt-3 max-w-md text-base text-muted-foreground text-balance sm:text-lg">
            Paste a video, playlist, or channel. Preview the audio, rename
            tracks, and download clean files you actually want to keep.
          </p>

          <form
            onSubmit={handleSubmit}
            className="animate-fade-up-delay-2 mt-9 w-full"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="Paste a YouTube video, playlist, or channel URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  leftIcon={<Link2 size={16} />}
                  autoComplete="off"
                  inputMode="url"
                  aria-label="YouTube URL"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="sm:px-7"
                rightIcon={<ArrowRight size={18} />}
              >
                Convert
              </Button>
            </div>
          </form>

          <div className="animate-fade-up-delay-2 mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={secondaryHref}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent/60"
            >
              {secondaryLabel}
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/pages/convert"
              className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              Open converter
            </Link>
          </div>

          <p className="animate-fade-up-delay-2 mt-6 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
            tubetocd.com · MP3 · MP4 · free to start
          </p>
        </div>
      </section>

      <section
        id="how"
        className="scroll-mt-20 border-t border-border/50 px-4 py-16 sm:px-8 sm:py-20"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
              How it works
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Three steps. Collection in hand.
            </h2>
            <p className="mt-3 text-base text-muted-foreground text-balance">
              TubeToCD is a YouTube music desk — built for quick presses, not
              another crowded converter maze.
            </p>
          </div>

          <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step) => (
              <li key={step.n} className="relative text-center sm:text-left">
                <span className="font-display text-4xl font-extrabold leading-none text-primary/35">
                  {step.n}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-balance">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex justify-center">
            <Button
              size="lg"
              onClick={() => router.push("/pages/convert")}
              rightIcon={<ArrowRight size={16} />}
            >
              Start converting
            </Button>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="scroll-mt-20 border-t border-border/50 px-4 py-16 sm:px-8 sm:py-20"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
              Features
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Everything you need to pull and keep audio
            </h2>
            <p className="mt-3 text-base text-muted-foreground text-balance">
              From a single video to a saved library — formats, previews, and a
              desk that stays out of the way.
            </p>
          </div>

          <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Icon size={16} strokeWidth={2.25} />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Formats
            </span>
            {FORMATS.map((fmt) => (
              <span
                key={fmt}
                className="inline-flex h-7 items-center rounded border border-border bg-card px-2.5 font-mono text-xs font-semibold text-foreground"
              >
                {fmt}
              </span>
            ))}
            <span className="text-xs text-muted-foreground">
              · MP3 extract · MP4 direct from YouTube
            </span>
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
              Music desk
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              A full listening desk when you sign in
            </h2>
            <p className="mt-3 text-base text-muted-foreground text-balance">
              Search YouTube, save channels and playlists, manage transfers, and
              keep a player running while you convert. Guest converts work
              without an account — sign in when you want your library to stick.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-foreground/85">
              {[
                "Search and convert from one place",
                "Saved channels, playlists, and batch download",
                "Always-on Now Playing bar",
                "Light & dark desk theme",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() =>
                  router.push(authed ? "/home" : "/pages/register")
                }
                rightIcon={<ArrowRight size={16} />}
              >
                {authed ? "Open music desk" : "Create free account"}
              </Button>
              {!authed && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => router.push("/pages/login")}
                >
                  Log in
                </Button>
              )}
            </div>
          </div>

          <DeskPreview className="animate-fade-up" />
        </div>
      </section>

      <section className="border-t border-border/50 px-4 py-16 sm:px-8 sm:py-20">
        <div className="relative mx-auto max-w-3xl overflow-hidden px-2 text-center">
          <div
            className="pointer-events-none absolute inset-0 -z-0 flex items-center justify-center opacity-40"
            aria-hidden
          >
            <WaveformMark className="w-full max-w-xl animate-soft-pulse" />
          </div>
          <div className="relative z-10">
            <Radio
              className="mx-auto mb-4 text-primary"
              size={28}
              strokeWidth={1.75}
              aria-hidden
            />
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Paste a link. Press the track.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground text-balance">
              No ads maze. No mystery downloads. Just a clean path from YouTube
              to files that belong in your collection — at{" "}
              <span className="text-foreground">tubetocd.com</span>.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => router.push("/pages/convert")}
                rightIcon={<ArrowRight size={16} />}
              >
                Convert a link
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  router.push(authed ? "/home" : "/pages/register")
                }
              >
                {authed ? "Open desk" : "Sign up free"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
