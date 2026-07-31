"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { DeskButton } from "@/components/desk/chrome";
import { cn } from "@/lib/utils";

export type PageSize = number | "all";

export const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100, "all"];

export const DEFAULT_PAGE_SIZE: PageSize = 25;

export function pageSizeLabel(size: PageSize) {
  return size === "all" ? "All" : String(size);
}

export function PaginationBar({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  className?: string;
}) {
  const perPage = pageSize === "all" ? total : pageSize;
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = total === 0 ? 0 : Math.min(total, page * perPage);

  return (
    <div
      className={cn(
        "lw-inset flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-1.5 font-mono text-[0.68rem] text-muted-foreground",
        className,
      )}
    >
      <label className="flex items-center gap-1.5">
        <span className="uppercase tracking-[0.08em]">Show</span>
        <select
          value={String(pageSize)}
          onChange={(e) =>
            onPageSizeChange(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          aria-label="Rows per page"
          className="lw-bevel px-1.5 py-1 font-mono text-[0.68rem] font-bold text-foreground outline-none"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={String(size)} value={String(size)}>
              {pageSizeLabel(size)}
            </option>
          ))}
        </select>
        <span className="uppercase tracking-[0.08em]">per page</span>
      </label>

      <span className="truncate">
        {total === 0 ? "No rows" : `${first}–${last} of ${total}`}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <DeskButton
          className="px-1.5"
          icon={<ChevronsLeft size={12} />}
          aria-label="First page"
          title="First page"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        />
        <DeskButton
          className="px-1.5"
          icon={<ChevronLeft size={12} />}
          aria-label="Previous page"
          title="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="px-1 uppercase tracking-[0.08em]">
          Page {page} of {pageCount}
        </span>
        <DeskButton
          className="px-1.5"
          icon={<ChevronRight size={12} />}
          aria-label="Next page"
          title="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        />
        <DeskButton
          className="px-1.5"
          icon={<ChevronsRight size={12} />}
          aria-label="Last page"
          title="Last page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(pageCount)}
        />
      </div>
    </div>
  );
}
