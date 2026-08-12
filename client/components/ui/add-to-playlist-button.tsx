"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ListMusic, ListPlus, Plus } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import {
  addTracksToPlaylist,
  createLocalPlaylist,
  playlistDetailPath,
  type PlaylistTrackInput,
  type SavedPlaylist,
} from "@/lib/playlists";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  track: PlaylistTrackInput | null;
  playlists: SavedPlaylist[];
  onPlaylistsChange?: (playlists: SavedPlaylist[]) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  /** Icon-only trigger for dense tables. */
  compact?: boolean;
  className?: string;
  /** Extra class on the floating menu (e.g. higher z-index over modals). */
  menuClassName?: string;
};

export function AddToPlaylistButton({
  track,
  playlists,
  onPlaylistsChange,
  disabled,
  size = "sm",
  compact = false,
  className,
  menuClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  /** Playlists this track was added to (or already in) during this open session. */
  const [inPlaylistIds, setInPlaylistIds] = useState<Set<number>>(new Set());
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280;
    setMenuPos({
      left: Math.min(rect.left, Math.max(8, window.innerWidth - 288)),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, [open, creating, playlists.length]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setCreating(false);
      setNewTitle("");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setCreating(false);
        setNewTitle("");
      }
    };
    // Close on page/table scroll, but not when scrolling the playlist list itself.
    const onScroll = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Node &&
        menuRef.current &&
        (target === menuRef.current || menuRef.current.contains(target))
      ) {
        return;
      }
      setOpen(false);
      setCreating(false);
      setNewTitle("");
    };
    const onResize = () => {
      setOpen(false);
      setCreating(false);
      setNewTitle("");
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setCreating(false);
    setNewTitle("");
  };

  const openMenu = (event?: ReactMouseEvent) => {
    event?.stopPropagation();
    event?.preventDefault();
    if (!isAuthenticated()) {
      toast.error("Sign in to add songs to a playlist");
      return;
    }
    if (!track) {
      toast.error("No song selected");
      return;
    }
    if (!open) {
      setInPlaylistIds(new Set());
      setCreating(false);
      setNewTitle("");
    }
    setOpen((v) => !v);
  };

  const finishAdd = (
    playlist: SavedPlaylist,
    added: number,
    skipped: number,
  ) => {
    onPlaylistsChange?.(
      [playlist, ...playlists.filter((p) => p.id !== playlist.id)].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    );
    setInPlaylistIds((prev) => new Set(prev).add(playlist.id));

    // Keep the menu open so the same song can be added to more playlists.
    if (added > 0) {
      toast.success(
        <span>
          Added to{" "}
          <Link
            href={playlistDetailPath(playlist.id)}
            className="font-semibold underline underline-offset-2"
          >
            {playlist.title}
          </Link>
          {" — pick another or close"}
        </span>,
      );
    } else if (skipped > 0) {
      toast.message(`Already in “${playlist.title}”`);
    }
  };

  const handleAdd = async (playlist: SavedPlaylist) => {
    if (!track || busyId != null) return;
    if (inPlaylistIds.has(playlist.id)) {
      toast.message(`Already in “${playlist.title}”`);
      return;
    }
    setBusyId(playlist.id);
    try {
      const result = await addTracksToPlaylist(playlist.id, track);
      finishAdd(result, result.added ?? 1, result.skipped ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!track || busyId != null) return;
    const title = newTitle.trim();
    if (!title) {
      toast.error("Enter a playlist name");
      return;
    }
    setBusyId("new");
    try {
      const created = await createLocalPlaylist(title);
      const result = await addTracksToPlaylist(created.id, track);
      finishAdd(result, result.added ?? 1, result.skipped ?? 0);
      setCreating(false);
      setNewTitle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusyId(null);
    }
  };

  const menu =
    open &&
    menuPos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          left: Math.max(8, menuPos.left),
          top: menuPos.top,
          bottom: menuPos.bottom,
        }}
        className={cn(
          "z-[110] w-72 overflow-hidden rounded-xl border border-border/70",
          "bg-card shadow-panel dark:shadow-panel-dark animate-fade-up",
          menuClassName,
        )}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
          <ListMusic size={12} className="text-muted-foreground" />
          <p className="min-w-0 flex-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Add to playlist
          </p>
          <button
            type="button"
            className="font-mono text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            onClick={closeMenu}
          >
            Done
          </button>
        </div>

        {playlists.length === 0 && !creating ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No saved playlists yet. Create one below.
          </p>
        ) : (
          <ul
            className="m-0 max-h-56 list-none overflow-y-auto overscroll-contain p-1"
            onWheel={(event) => event.stopPropagation()}
          >
            {playlists.map((playlist) => {
              const alreadyIn = inPlaylistIds.has(playlist.id);
              return (
                <li key={playlist.id}>
                  <button
                    type="button"
                    disabled={busyId != null}
                    onClick={() => void handleAdd(playlist)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left",
                      "transition-colors hover:bg-primary/10",
                      (busyId === playlist.id || alreadyIn) && "bg-primary/10",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {playlist.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {playlist.trackCount}{" "}
                        {playlist.trackCount === 1 ? "track" : "tracks"}
                        {alreadyIn ? " · added" : ""}
                      </span>
                    </span>
                    {busyId === playlist.id ? (
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin-wire"
                        aria-hidden
                      />
                    ) : alreadyIn ? (
                      <Check size={14} className="shrink-0 text-primary" />
                    ) : (
                      <ListPlus size={14} className="shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border/60 p-2">
          {creating ? (
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
            >
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New playlist name"
                disabled={busyId != null}
                className={cn(
                  "h-8 min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2",
                  "text-sm text-foreground outline-none focus:border-primary",
                )}
              />
              <Button
                type="submit"
                size="sm"
                loading={busyId === "new"}
                disabled={!newTitle.trim()}
              >
                Add
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              fullWidth
              leftIcon={<Plus size={14} />}
              onClick={() => setCreating(true)}
            >
              New playlist
            </Button>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex", className)}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {compact ? (
        <button
          type="button"
          disabled={disabled || busyId != null}
          aria-label="Add to playlist"
          aria-expanded={open}
          title="Add to playlist"
          className={cn(
            "lw-heart shrink-0",
            open && "lw-heart-saved",
          )}
          onClick={openMenu}
        >
          <ListPlus size={12} strokeWidth={2.25} aria-hidden />
        </button>
      ) : (
        <Button
          size={size}
          variant="outline"
          disabled={disabled || busyId != null}
          leftIcon={<ListPlus size={14} />}
          aria-expanded={open}
          onClick={openMenu}
        >
          Add to playlist
        </Button>
      )}
      {menu}
    </div>
  );
}

/** Build a playlist track payload from a desk row / library item. */
export function playlistTrackFromDeskItem(item: {
  videoId?: string | null;
  url?: string | null;
  title: string;
  channel?: string | null;
  duration?: number | null;
  sizeMp3?: number | null;
  size?: number | null;
  views?: number | null;
  thumbnail?: string | null;
}): PlaylistTrackInput | null {
  const videoId = item.videoId || undefined;
  const url = item.url || undefined;
  if (!videoId && !url) return null;
  return {
    videoId,
    url: url || undefined,
    title: item.title,
    uploader: item.channel ?? null,
    filename: item.title,
    duration: item.duration ?? null,
    filesize: item.sizeMp3 ?? item.size ?? null,
    viewCount: item.views ?? null,
    thumbnail: item.thumbnail ?? null,
  };
}
