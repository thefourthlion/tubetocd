"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  BookmarkPlus,
  Download,
  Headphones,
  ListMusic,
  Radio,
  Youtube,
} from "lucide-react";
import {
  DeskActionButton,
  DeskButton,
  DeskStrip,
} from "@/components/desk/chrome";
import { FilterPanel } from "@/components/desk/filter-panel";
import { ItemDetailsModal } from "@/components/desk/item-details-modal";
import {
  DEFAULT_PAGE_SIZE,
  PaginationBar,
  type PageSize,
} from "@/components/desk/pagination-bar";
import { ResultsTable } from "@/components/desk/results-table";
import { useDeskActions } from "@/components/desk/use-desk-actions";
import { useRatings } from "@/components/desk/use-ratings";
import { useSavedHearts } from "@/components/desk/use-saved-hearts";
import {
  sortDeskItems,
  type DeskItem,
  type DeskSort,
  type DeskSortKey,
} from "@/lib/desk";
import { formatBytes } from "@/lib/youtube";

type MediaFilter = "all" | "audio" | "playlists" | "channels";

const MEDIA_LABEL: Record<MediaFilter, string> = {
  all: "All",
  audio: "Audio",
  playlists: "Playlists",
  channels: "Channels",
};

function facetCounts(items: DeskItem[], pick: (item: DeskItem) => string | null) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = pick(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );
}

/**
 * The desk's working area: filter rail, results table and action bar.
 * Both the Search and Library routes render through this.
 */
export function DeskBrowser({
  items,
  toolbar,
  notice,
  emptyLabel,
  listName,
  onLibraryChange,
}: {
  items: DeskItem[];
  toolbar: ReactNode;
  notice: string;
  emptyLabel: string;
  listName: string;
  onLibraryChange?: () => void;
}) {
  const [drill, setDrill] = useState<{
    items: DeskItem[];
    title: string;
  } | null>(null);
  const [media, setMedia] = useState<MediaFilter>("all");
  const [channel, setChannel] = useState<string | null>(null);
  const [album, setAlbum] = useState<string | null>(null);
  const [sort, setSort] = useState<DeskSort | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const actions = useDeskActions({
    onLibraryChange,
    onDrill: (drillItems, title) => {
      setDrill({ items: drillItems, title });
      setSelectedKey(null);
      setDetailsOpen(false);
    },
  });

  const { ratings, rate, canRate } = useRatings();
  const {
    isSaved,
    isPending: isSavePending,
    toggle: toggleSave,
  } = useSavedHearts({ onLibraryChange });

  const sourceItems = drill?.items ?? items;

  const baseItems = useMemo(
    () =>
      sourceItems.map((item) => {
        const quality = item.ratingKey ? ratings[item.ratingKey] ?? null : null;
        return quality === item.quality ? item : { ...item, quality };
      }),
    [sourceItems, ratings],
  );

  const mediaFiltered = useMemo(() => {
    if (media === "all") return baseItems;
    if (media === "playlists") {
      return baseItems.filter(
        (item) => item.kind === "playlist" && item.type !== "channel",
      );
    }
    if (media === "channels") {
      return baseItems.filter((item) => item.type === "channel");
    }
    return baseItems.filter((item) => item.kind !== "playlist");
  }, [baseItems, media]);

  const filteredItems = useMemo(
    () =>
      mediaFiltered.filter(
        (item) =>
          (channel === null || item.channel === channel) &&
          (album === null || item.album === album),
      ),
    [mediaFiltered, channel, album],
  );

  const visibleItems = useMemo(
    () => sortDeskItems(filteredItems, sort),
    [filteredItems, sort],
  );

  const toggleSort = useCallback((key: DeskSortKey) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: "desc" },
    );
  }, []);

  // A new filter/search result set puts us back on the first page.
  // Keyed on the inputs rather than `filteredItems` so rating a row, which
  // rebuilds the list, does not throw the reader back to page one.
  useEffect(() => {
    setPage(1);
  }, [items, drill, media, channel, album]);

  const pageCount =
    pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const indexOffset = pageSize === "all" ? 0 : (currentPage - 1) * pageSize;

  const pageItems = useMemo(
    () =>
      pageSize === "all"
        ? visibleItems
        : visibleItems.slice(indexOffset, indexOffset + pageSize),
    [visibleItems, pageSize, indexOffset],
  );

  const goToPage = useCallback((next: number) => {
    setPage(next);
    setSelectedKey(null);
    setDetailsOpen(false);
  }, []);

  const changePageSize = useCallback((next: PageSize) => {
    setPageSize(next);
    setPage(1);
    setSelectedKey(null);
    setDetailsOpen(false);
  }, []);

  const selected = useMemo(
    () => visibleItems.find((item) => item.key === selectedKey) ?? null,
    [visibleItems, selectedKey],
  );

  // Distinguish "the search found nothing" from "the filter rail is hiding
  // everything", which is easy to hit after a filter outlives its result set.
  const tableEmptyLabel =
    baseItems.length > 0 && visibleItems.length === 0
      ? "No rows match the current filters — reset them in the panel on the left."
      : emptyLabel;

  const mediaOptions = useMemo(
    () => [
      { value: "all", label: MEDIA_LABEL.all, count: baseItems.length },
      {
        value: "audio",
        label: MEDIA_LABEL.audio,
        count: baseItems.filter((i) => i.kind !== "playlist").length,
      },
      {
        value: "playlists",
        label: MEDIA_LABEL.playlists,
        count: baseItems.filter(
          (i) => i.kind === "playlist" && i.type !== "channel",
        ).length,
      },
      {
        value: "channels",
        label: MEDIA_LABEL.channels,
        count: baseItems.filter((i) => i.type === "channel").length,
      },
    ],
    [baseItems],
  );

  const rateItem = useCallback(
    (item: DeskItem, stars: number) => {
      if (!item.ratingKey) return;
      void rate(item.ratingKey, stars);
    },
    [rate],
  );

  /** Selecting a row also opens its details sheet, where the actions live. */
  const openRow = useCallback((item: DeskItem) => {
    setSelectedKey(item.key);
    setDetailsOpen(true);
  }, []);

  /** Double-click / Enter: open a playlist's track list; otherwise show details. */
  const activateRow = useCallback(
    (item: DeskItem) => {
      setSelectedKey(item.key);
      if (item.kind === "playlist") {
        setDetailsOpen(false);
        void actions.openPlaylist(item);
        return;
      }
      setDetailsOpen(true);
    },
    [actions],
  );

  const currentName = drill?.title || listName;

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border/60 bg-card px-2 py-2">
        {toolbar}
      </div>

      <DeskStrip>
        <Radio size={12} className="shrink-0" />
        <span className="truncate">
          {drill ? `Playlist — ${drill.title}` : notice}
        </span>
      </DeskStrip>

      <div className="grid min-h-0 flex-1 gap-2 p-2 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <FilterPanel
          className="hidden lg:flex"
          media={{
            selected: media,
            onSelect: (value) => setMedia(value as MediaFilter),
            options: mediaOptions,
          }}
          facets={[
            {
              id: "channel",
              label: "Channel",
              values: facetCounts(mediaFiltered, (i) => i.channel),
              selected: channel,
              onSelect: setChannel,
            },
            {
              id: "album",
              label: "Album",
              values: facetCounts(mediaFiltered, (i) => i.album),
              selected: album,
              onSelect: setAlbum,
            },
          ]}
        />

        <div className="flex min-h-0 flex-col gap-2">
          {drill && (
            <div className="flex items-center gap-2">
              <DeskButton
                icon={<ArrowLeft size={12} />}
                onClick={() => {
                  setDrill(null);
                  setSelectedKey(null);
                }}
              >
                Back
              </DeskButton>
              <p className="truncate font-mono text-[0.68rem] text-muted-foreground">
                {drill.title}
              </p>
            </div>
          )}

          <ResultsTable
            className="min-h-[15rem] flex-1"
            items={pageItems}
            selectedKey={selectedKey}
            onSelect={openRow}
            onActivate={activateRow}
            emptyLabel={tableEmptyLabel}
            sort={sort}
            onSort={toggleSort}
            onRate={canRate ? rateItem : undefined}
            isSaved={isSaved}
            isSavePending={isSavePending}
            onToggleSave={(item) => void toggleSave(item)}
            indexOffset={indexOffset}
          />

          {visibleItems.length > 0 && (
            <PaginationBar
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={visibleItems.length}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <DeskActionButton
              icon={<Download size={16} />}
              label="Download"
              disabled={!selected || actions.busy}
              onClick={() => selected && void actions.download(selected)}
            />
            <DeskActionButton
              icon={<Headphones size={16} />}
              label="Listen"
              disabled={!selected}
              onClick={() =>
                selected && void actions.listen(selected, visibleItems)
              }
            />
            <DeskActionButton
              icon={<Youtube size={16} />}
              label="Watch"
              disabled={!selected}
              onClick={() => selected && actions.watch(selected)}
            />
            <DeskActionButton
              icon={<ListMusic size={16} />}
              label="Open list"
              disabled={!selected || selected.kind !== "playlist" || actions.busy}
              onClick={() => selected && void actions.openPlaylist(selected)}
            />
            <DeskActionButton
              icon={<BookmarkPlus size={16} />}
              label="Save list"
              disabled={actions.busy || visibleItems.length === 0}
              onClick={() => void actions.saveList(visibleItems, currentName)}
            />
            <DeskActionButton
              className="ml-auto"
              icon={<Download size={16} />}
              label="Get all"
              disabled={actions.busy || visibleItems.length === 0}
              onClick={() => void actions.downloadAll(visibleItems, currentName)}
            />
          </div>

          <div className="lw-inset px-2 py-1.5">
            <p className="truncate font-mono text-[0.68rem] text-muted-foreground">
              {selected
                ? [
                    selected.title,
                    selected.channel,
                    selected.sizeMp3 || selected.size
                      ? `${formatBytes(selected.sizeMp3 ?? selected.size)} MP3`
                      : null,
                    selected.sizeMp4
                      ? `${formatBytes(selected.sizeMp4)} MP4`
                      : null,
                    selected.type.toUpperCase(),
                    selected.quality ? `Rated ${selected.quality}★` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")
                : "No row selected — click a result to open its details."}
            </p>
          </div>
        </div>
      </div>

      {detailsOpen && selected && (
        <ItemDetailsModal
          item={selected}
          busy={actions.busy}
          onClose={() => setDetailsOpen(false)}
          onDownload={() => void actions.download(selected)}
          onListen={() => void actions.listen(selected, visibleItems)}
          onWatch={() => actions.watch(selected)}
          onOpenList={() => void actions.openPlaylist(selected)}
          onRate={
            canRate && selected.ratingKey
              ? (stars) => rateItem(selected, stars)
              : undefined
          }
        />
      )}
    </>
  );
}
