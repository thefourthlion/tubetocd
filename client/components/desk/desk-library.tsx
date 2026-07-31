"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Filter, Loader2, RefreshCw } from "lucide-react";
import { DeskButton } from "@/components/desk/chrome";
import { DeskBrowser } from "@/components/desk/desk-browser";
import {
  DeskItem,
  deskItemFromLibraryTrack,
  deskItemFromSavedPlaylist,
  deskItemFromYoutubeLink,
} from "@/lib/desk";
import { fetchLibrary } from "@/lib/library";

export function DeskLibrary() {
  const [items, setItems] = useState<DeskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [stats, setStats] = useState({
    playlists: 0,
    tracks: 0,
    videos: 0,
    downloadedTracks: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLibrary({ type: "all" });
      setStats(data.stats);
      setItems([
        ...data.playlists.map(deskItemFromSavedPlaylist),
        ...data.tracks.map(deskItemFromLibraryTrack),
        ...data.videos.map(deskItemFromYoutubeLink),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        (item.channel || "").toLowerCase().includes(needle) ||
        (item.album || "").toLowerCase().includes(needle),
    );
  }, [items, filter]);

  return (
    <DeskBrowser
      items={filtered}
      listName="y2m-library"
      onLibraryChange={load}
      notice={`Library — ${stats.playlists} playlists, ${stats.tracks} tracks, ${stats.downloadedTracks} downloaded`}
      emptyLabel={
        loading
          ? "Loading your library…"
          : "Your library is empty — search YouTube and download something."
      }
      toolbar={
        <div className="flex min-w-0 flex-1 gap-1.5">
          <span className="lw-inset flex min-w-0 flex-1 items-center gap-1.5 px-2">
            <Filter size={13} className="shrink-0 text-primary" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter your library by title, channel or album"
              aria-label="Filter library"
              className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </span>
          <DeskButton
            icon={
              loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )
            }
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </DeskButton>
        </div>
      }
    />
  );
}
