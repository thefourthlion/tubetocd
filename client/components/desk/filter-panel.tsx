"use client";

import { DeskPaneLabel } from "@/components/desk/chrome";
import { cn } from "@/lib/utils";

export type FacetGroup = {
  id: string;
  label: string;
  values: Array<{ value: string; count: number }>;
  selected: string | null;
  onSelect: (value: string | null) => void;
};

export function FilterPanel({
  media,
  facets,
  className,
}: {
  media: {
    selected: string;
    onSelect: (value: string) => void;
    options: Array<{ value: string; label: string; count: number }>;
  };
  facets: FacetGroup[];
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="lw-window flex min-h-0 flex-1 flex-col">
        <div className="lw-header px-2 py-1">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-foreground">
            Filter results
          </p>
        </div>

        <div className="px-1.5 pb-2">
          <DeskPaneLabel className="px-1">Media</DeskPaneLabel>
          <div className="lw-inset max-h-32 overflow-auto p-1">
            {media.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="lw-facet"
                data-active={media.selected === option.value}
                onClick={() => media.onSelect(option.value)}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
        </div>

        {facets.map((facet) => (
          <div key={facet.id} className="px-1.5 pb-2">
            <DeskPaneLabel className="px-1">{facet.label}</DeskPaneLabel>
            <div className="lw-inset max-h-44 overflow-auto p-1">
              <button
                type="button"
                className="lw-facet"
                data-active={facet.selected === null}
                onClick={() => facet.onSelect(null)}
              >
                All ({facet.values.length})
              </button>
              {facet.values.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className="lw-facet"
                  data-active={facet.selected === entry.value}
                  title={entry.value}
                  onClick={() =>
                    facet.onSelect(
                      facet.selected === entry.value ? null : entry.value,
                    )
                  }
                >
                  {entry.value}
                  <span className="ml-1 text-muted-foreground">
                    ({entry.count})
                  </span>
                </button>
              ))}
              {facet.values.length === 0 && (
                <p className="px-2 py-1 font-mono text-[0.68rem] text-muted-foreground">
                  No results yet
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
