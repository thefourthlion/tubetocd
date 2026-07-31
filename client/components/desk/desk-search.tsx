"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Youtube } from "lucide-react";
import { DeskButton } from "@/components/desk/chrome";
import { DeskBrowser } from "@/components/desk/desk-browser";
import {
  DeskItem,
  deskItemFromPlaylistEntry,
  deskItemFromSearchResult,
} from "@/lib/desk";
import {
  resolveYoutubeInfo,
  searchYoutube,
  type SearchScope,
} from "@/lib/youtube";

const SCOPE_OPTIONS: Array<{ value: SearchScope; label: string }> = [
  { value: "all", label: "All" },
  { value: "video", label: "Videos" },
  { value: "playlist", label: "Playlists" },
];

const SCOPE_NOUN: Record<SearchScope, string> = {
  all: "results",
  video: "videos",
  playlist: "playlists",
};

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function DeskSearch() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<DeskItem[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const requestRef = useRef(0);
  const bootstrapped = useRef(false);
  /** Last keyword searched, so flipping the scope can re-run it. */
  const lastKeyword = useRef<string | null>(null);

  const runSearch = useCallback(async (raw: string, searchScope: SearchScope) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      toast.error("Type something to search YouTube");
      return;
    }

    const requestId = ++requestRef.current;
    setSearching(true);
    try {
      if (looksLikeUrl(trimmed)) {
        // A pasted link resolves to exactly one thing, so the scope is moot.
        lastKeyword.current = null;
        const info = await resolveYoutubeInfo(trimmed);
        if (requestId !== requestRef.current) return;
        if (info.type === "playlist" || info.type === "channel") {
          setItems(
            info.entries.map((entry) =>
              deskItemFromPlaylistEntry(entry, info.playlistId),
            ),
          );
          setLabel(
            `${info.title} — ${info.count} ${
              info.type === "channel" ? "videos" : "tracks"
            }`,
          );
        } else {
          setItems([
            deskItemFromPlaylistEntry(
              {
                id: info.videoId || info.url,
                title: info.title,
                uploader: info.uploader,
                filename: info.filename,
                url: info.url,
                duration: info.duration,
                filesize: info.filesize,
                filesizeEstimated: info.filesizeEstimated,
                viewCount: info.viewCount,
                thumbnail: info.thumbnail,
                index: 1,
              },
              null,
            ),
          ]);
          setLabel(info.title);
        }
        return;
      }

      lastKeyword.current = trimmed;
      const response = await searchYoutube(trimmed, {
        limit: 25,
        type: searchScope,
      });
      if (requestId !== requestRef.current) return;
      setItems(response.results.map(deskItemFromSearchResult));
      setLabel(
        `${response.count} ${SCOPE_NOUN[response.type] ?? "results"} for “${
          response.query
        }”`,
      );
    } catch (err) {
      if (requestId !== requestRef.current) return;
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (requestId === requestRef.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    const initial = searchParams.get("q") || searchParams.get("url");
    if (!initial?.trim()) return;
    bootstrapped.current = true;
    const requested = searchParams.get("type");
    const initialScope =
      SCOPE_OPTIONS.find((option) => option.value === requested)?.value ?? "all";
    setQuery(initial);
    setScope(initialScope);
    void runSearch(initial, initialScope);
  }, [searchParams, runSearch]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSearch(query, scope);
  };

  /** Switching scope re-asks YouTube, since it changes what gets fetched. */
  const changeScope = (next: SearchScope) => {
    if (next === scope) return;
    setScope(next);
    const keyword = lastKeyword.current;
    if (keyword) void runSearch(keyword, next);
  };

  return (
    <DeskBrowser
      items={items}
      listName={label || "y2m-search"}
      notice={
        label ||
        "Search YouTube by name, or paste a video / playlist URL. Double-click a row to listen."
      }
      emptyLabel={
        searching ? "Searching YouTube…" : "Search YouTube above to see results."
      }
      toolbar={
        <form
          onSubmit={handleSubmit}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
        >
          <span className="lw-inset flex min-w-[12rem] flex-1 items-center gap-1.5 px-2">
            <Search size={13} className="shrink-0 text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube — or paste a video / playlist URL"
              aria-label="Search YouTube"
              className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </span>

          <span
            role="group"
            aria-label="Search for"
            className="flex shrink-0 items-center gap-1"
          >
            {SCOPE_OPTIONS.map((option) => (
              <DeskButton
                key={option.value}
                active={scope === option.value}
                aria-pressed={scope === option.value}
                title={`Search YouTube for ${SCOPE_NOUN[option.value]}`}
                disabled={searching}
                onClick={() => changeScope(option.value)}
                className="px-2"
              >
                {option.label}
              </DeskButton>
            ))}
          </span>

          <DeskButton
            type="submit"
            icon={
              searching ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Youtube size={12} />
              )
            }
            disabled={searching}
          >
            {searching ? "Searching" : "Search"}
          </DeskButton>
        </form>
      }
    />
  );
}
