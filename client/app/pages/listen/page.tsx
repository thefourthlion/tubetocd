"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  downloadMp3,
  extractVideoId,
  resolveThumbnail,
  streamMp3Preview,
  youtubeWatchUrl,
} from "@/lib/youtube";
import { YoutubeThumb } from "@/components/youtube-media-links";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/ui/download-button";
import { DownloadPreset } from "@/lib/download-presets";
import { Panel } from "@/components/ui/panel";
import { LoadingBlock, PageShell } from "@/components/ui/page";

function ListenPlayer() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url");
  const videoIdParam = searchParams.get("v");
  const titleParam = searchParams.get("title");
  const thumbParam = searchParams.get("thumb");

  const videoId = videoIdParam || extractVideoId(urlParam);
  const sourceUrl = urlParam || (videoId ? youtubeWatchUrl(videoId) : null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [title, setTitle] = useState(titleParam || "Listen");
  const [thumbnail, setThumbnail] = useState<string | null>(
    resolveThumbnail(thumbParam, videoId, sourceUrl),
  );
  const [downloading, setDownloading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sourceUrl) {
      setLoading(false);
      setError("No video selected to listen to.");
      return;
    }

    const abort = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      const attempts = 2;
      const delays = [1500];
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (cancelled || abort.signal.aborted) return;
        try {
          if (attempt > 1) {
            setError(`Retrying… (${attempt}/${attempts})`);
          }
          const result = await streamMp3Preview(sourceUrl, {
            filename: titleParam || undefined,
            thumbnail: thumbParam,
            signal: abort.signal,
          });
          if (cancelled || abort.signal.aborted) {
            URL.revokeObjectURL(result.objectUrl);
            return;
          }
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          objectUrlRef.current = result.objectUrl;
          setAudioUrl(result.objectUrl);
          setTitle(result.title || titleParam || "Listen");
          if (result.thumbnail) {
            setThumbnail(result.thumbnail);
          }
          setError(null);
          return;
        } catch (err) {
          if (
            cancelled ||
            abort.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            return;
          }
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          if (
            /private|members-only|sign.?in|cookies|not a bot|403|blocked the stream/i.test(
              message,
            )
          ) {
            break;
          }
          if (attempt < attempts) {
            await new Promise((r) => setTimeout(r, delays[attempt - 1] ?? 1500));
            continue;
          }
        }
      }

      if (!cancelled && !abort.signal.aborted) {
        setError(
          lastError instanceof Error
            ? lastError.message
            : "Failed to prepare audio",
        );
      }
    };

    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      abort.abort();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [sourceUrl, titleParam, thumbParam]);

  const handleDownload = async (preset: DownloadPreset) => {
    if (!sourceUrl) return;
    setDownloading(true);
    try {
      const result = await downloadMp3(sourceUrl, {
        filename: title,
        thumbnail,
        format: preset.format,
        quality: preset.quality,
      });
      toast.success(`Downloaded “${result.title}” (${preset.label})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (!sourceUrl) {
    return (
      <PageShell>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No video selected to listen to.</p>
          <Link href="/pages/convert" className="mt-4 inline-block">
            <Button variant="soft">Back to convert</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="md">
      <div className="flex flex-wrap items-center gap-2 animate-fade-up">
        <Link href="/home">
          <Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={14} />}>
            Back to desk
          </Button>
        </Link>
        {videoId && (
          <a
            href={youtubeWatchUrl(videoId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="sm"
              variant="outline"
              leftIcon={<ExternalLink size={14} />}
            >
              YouTube
            </Button>
          </a>
        )}
        <DownloadButton
          loading={downloading}
          disabled={loading || !!error}
          onDownload={handleDownload}
        />
      </div>

      <Panel className="animate-fade-up-delay-1">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <YoutubeThumb
            src={thumbnail}
            alt={title}
            className="h-36 w-36 shrink-0 rounded-xl object-cover sm:h-40 sm:w-40"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary">
              MP3 preview
            </p>
            <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Same audio you&apos;ll get when you download — converted here.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {loading && (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center">
              <p className="font-medium text-foreground">Preparing MP3…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Converting audio so you can preview the download.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
              <p className="font-medium text-destructive">{error}</p>
              <Link href="/pages/convert" className="mt-3 inline-block">
                <Button size="sm" variant="secondary">
                  Try another link
                </Button>
              </Link>
            </div>
          )}

          {!loading && !error && audioUrl && (
            <audio
              controls
              autoPlay
              src={audioUrl}
              className="w-full rounded-lg"
              preload="auto"
            >
              Your browser does not support audio playback.
            </audio>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}

export default function ListenPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <LoadingBlock label="Loading player…" />
        </PageShell>
      }
    >
      <ListenPlayer />
    </Suspense>
  );
}
