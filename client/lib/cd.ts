/** CD capacity presets for the desk CD builder (data CD / MP3 burn). */

export type CdMediaId = "cdr-650" | "cdr-700" | "cdr-800" | "mini-185" | "custom";

export type CdMedia = {
  id: CdMediaId;
  label: string;
  /** Marketing size label, e.g. "700 MB". */
  sizeLabel: string;
  /** Usable bytes (binary MB). Leave null for custom. */
  capacityBytes: number | null;
  /** Approximate audio length at Red Book rates — informational only. */
  audioMinutes: number | null;
  description: string;
};

/** Binary megabytes → bytes. */
export function mbToBytes(mb: number): number {
  return Math.round(mb * 1024 * 1024);
}

export const CD_MEDIA: CdMedia[] = [
  {
    id: "cdr-650",
    label: "CD-R 650",
    sizeLabel: "650 MB",
    capacityBytes: mbToBytes(650),
    audioMinutes: 74,
    description: "Classic 74-minute disc",
  },
  {
    id: "cdr-700",
    label: "CD-R 700",
    sizeLabel: "700 MB",
    capacityBytes: mbToBytes(700),
    audioMinutes: 80,
    description: "Most common blank CD",
  },
  {
    id: "cdr-800",
    label: "CD-R 800",
    sizeLabel: "800 MB",
    capacityBytes: mbToBytes(800),
    audioMinutes: 90,
    description: "Overburn / 90-minute blanks",
  },
  {
    id: "mini-185",
    label: "Mini CD",
    sizeLabel: "185 MB",
    capacityBytes: mbToBytes(185),
    audioMinutes: 21,
    description: "8cm mini disc",
  },
  {
    id: "custom",
    label: "Custom",
    sizeLabel: "Custom",
    capacityBytes: null,
    audioMinutes: null,
    description: "Set your own MB limit",
  },
];

export const DEFAULT_CD_MEDIA_ID: CdMediaId = "cdr-700";

export function getCdMedia(id: CdMediaId): CdMedia {
  return CD_MEDIA.find((m) => m.id === id) || CD_MEDIA[1];
}

export function resolveCdCapacityBytes(
  mediaId: CdMediaId,
  customMb: number,
): number {
  const media = getCdMedia(mediaId);
  if (media.capacityBytes != null) return media.capacityBytes;
  return mbToBytes(Math.max(1, customMb || 700));
}

export function formatCdFill(usedBytes: number, capacityBytes: number): string {
  const pct = capacityBytes > 0 ? (usedBytes / capacityBytes) * 100 : 0;
  return `${pct.toFixed(1)}%`;
}

export function sanitizeCdName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return cleaned || "My CD";
}
