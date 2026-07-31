"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Heart,
  ListMusic,
  Music4,
} from "lucide-react";
import { QualityStars } from "@/components/desk/chrome";
import type { DeskItem, DeskSort, DeskSortKey } from "@/lib/desk";
import { formatBytes, formatDuration, formatViews } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const COLUMNS: { key: DeskSortKey; label: string; className: string }[] = [
  { key: "quality", label: "Quality", className: "w-[4.5rem]" },
  { key: "index", label: "#", className: "w-10" },
  { key: "title", label: "Name", className: "" },
  { key: "type", label: "Type", className: "w-[5.5rem]" },
  { key: "size", label: "Size", className: "w-[7.5rem]" },
  { key: "duration", label: "Length", className: "w-20" },
  { key: "views", label: "Views", className: "hidden w-24 md:table-cell" },
  { key: "channel", label: "Channel", className: "hidden w-44 lg:table-cell" },
];

function TypeBadge({ item }: { item: DeskItem }) {
  const isChannel = item.type === "channel";
  const isPlaylist = item.kind === "playlist" && !isChannel;
  return (
    <span
      className={cn(
        "lw-type-badge",
        isChannel
          ? "lw-type-badge-channel"
          : isPlaylist
            ? "lw-type-badge-playlist"
            : "lw-type-badge-track",
      )}
      title={isChannel ? "Channel" : isPlaylist ? "Playlist" : "Video"}
    >
      {isChannel ? "channel" : isPlaylist ? "playlist" : "video"}
    </span>
  );
}

function sizeLine(bytes: number | null | undefined, estimated: boolean, label: string) {
  if (bytes == null || bytes <= 0) return null;
  return `${formatBytes(bytes)}${estimated ? "*" : ""} ${label}`;
}

function SizeCell({ item }: { item: DeskItem }) {
  const mp3 = sizeLine(item.sizeMp3 ?? item.size, item.sizeEstimated, "MP3");
  const mp4 = sizeLine(item.sizeMp4, item.sizeEstimated, "MP4");

  if (mp3 || mp4) {
    return (
      <span className="flex flex-col leading-tight">
        {mp3 ? <span>{mp3}</span> : null}
        {mp4 ? <span>{mp4}</span> : null}
      </span>
    );
  }

  if (item.kind === "playlist" && item.trackCount != null) {
    return `${item.trackCount} track${item.trackCount === 1 ? "" : "s"}`;
  }
  return "—";
}

function RowThumb({ item }: { item: DeskItem }) {
  const src = item.thumbnail;
  return (
    <span className="lw-row-thumb shrink-0" aria-hidden={!src}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : item.kind === "playlist" ? (
        <ListMusic size={14} className="text-amber-600 dark:text-amber-400" />
      ) : (
        <Music4 size={14} className="text-primary" />
      )}
    </span>
  );
}

function SaveHeart({
  saved,
  pending,
  disabled,
  label,
  onToggle,
}: {
  saved: boolean;
  pending?: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "lw-heart shrink-0",
        saved && "lw-heart-saved",
        pending && "lw-heart-pending",
      )}
      aria-label={label}
      aria-pressed={saved}
      disabled={disabled || pending}
      title={saved ? "Remove from library" : "Save for later download"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
        }
      }}
    >
      <Heart
        size={12}
        strokeWidth={2.25}
        fill={saved ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}

export function ResultsTable({
  items,
  selectedKey,
  onSelect,
  onActivate,
  emptyLabel,
  sort,
  onSort,
  onRate,
  isSaved,
  isSavePending,
  onToggleSave,
  indexOffset = 0,
  className,
}: {
  items: DeskItem[];
  selectedKey: string | null;
  onSelect: (item: DeskItem) => void;
  onActivate: (item: DeskItem) => void;
  emptyLabel: string;
  sort: DeskSort | null;
  onSort: (key: DeskSortKey) => void;
  /** Omitted when nobody is signed in, which leaves the stars read-only. */
  onRate?: (item: DeskItem, stars: number) => void;
  /** Whether this row is already in the signed-in user's library. */
  isSaved?: (item: DeskItem) => boolean;
  isSavePending?: (item: DeskItem) => boolean;
  /** Heart click — save or remove for later download. */
  onToggleSave?: (item: DeskItem) => void;
  /** Row number of the first item, so numbering continues across pages. */
  indexOffset?: number;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "lw-inset flex min-h-[12rem] items-center justify-center px-4 text-center",
          className,
        )}
      >
        <p className="font-mono text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn("lw-inset overflow-auto", className)}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  className={cn("lw-colhead", column.className)}
                  data-sorted={active ? "true" : undefined}
                  aria-sort={
                    active
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="lw-colhead-btn group/colhead"
                    onClick={() => onSort(column.key)}
                    title={`Sort by ${column.label}`}
                  >
                    <span className="min-w-0 truncate">{column.label}</span>
                    {active ? (
                      sort.direction === "asc" ? (
                        <ChevronUp size={11} className="shrink-0" />
                      ) : (
                        <ChevronDown size={11} className="shrink-0" />
                      )
                    ) : (
                      <ChevronsUpDown
                        size={11}
                        className="shrink-0 opacity-0 transition-opacity group-hover/colhead:opacity-50"
                      />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const selected = item.key === selectedKey;
            const isPlaylist = item.kind === "playlist";
            const saved = Boolean(isSaved?.(item));
            const savePending = Boolean(isSavePending?.(item));
            return (
              <tr
                key={item.key}
                className="lw-row"
                data-kind={item.kind}
                data-selected={selected ? "true" : undefined}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onActivate(item)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onActivate(item);
                }}
              >
                <td className="lw-cell">
                  <QualityStars
                    score={item.quality}
                    label={`Your rating for ${item.title}`}
                    onRate={
                      onRate && item.ratingKey
                        ? (stars) => onRate(item, stars)
                        : undefined
                    }
                  />
                </td>
                <td className="lw-cell lw-dim font-mono text-muted-foreground">
                  {indexOffset + index + 1}
                </td>
                <td className="lw-cell max-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {onToggleSave ? (
                      <SaveHeart
                        saved={saved}
                        pending={savePending}
                        label={
                          saved
                            ? `Remove ${item.title} from library`
                            : `Save ${item.title} for later`
                        }
                        onToggle={() => onToggleSave(item)}
                      />
                    ) : null}
                    <RowThumb item={item} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="inline-flex max-w-full items-center gap-1">
                        {isPlaylist ? (
                          <ListMusic
                            size={12}
                            className="shrink-0 text-amber-600 dark:text-amber-400"
                            aria-hidden
                          />
                        ) : (
                          <Music4
                            size={12}
                            className="shrink-0 text-primary"
                            aria-hidden
                          />
                        )}
                        <span className="truncate font-medium">{item.title}</span>
                      </span>
                      {isPlaylist && item.trackCount != null && (
                        <span className="lw-dim ml-1.5 font-mono text-[0.65rem] text-muted-foreground">
                          · {item.trackCount}{" "}
                          {item.trackCount === 1 ? "track" : "tracks"}
                        </span>
                      )}
                    </span>
                    {item.downloaded && (
                      <CheckCircle2
                        size={11}
                        className="shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-label="In library"
                      />
                    )}
                  </span>
                </td>
                <td className="lw-cell">
                  <TypeBadge item={item} />
                </td>
                <td className="lw-cell lw-dim font-mono text-muted-foreground">
                  <SizeCell item={item} />
                </td>
                <td className="lw-cell lw-dim font-mono text-muted-foreground">
                  {formatDuration(item.duration) || "—"}
                </td>
                <td className="lw-cell lw-dim hidden font-mono text-muted-foreground md:table-cell">
                  {formatViews(item.views) || "—"}
                </td>
                <td className="lw-cell lw-dim hidden text-muted-foreground lg:table-cell">
                  {item.channel || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
