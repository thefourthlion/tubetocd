export type DownloadFormat = "mp3" | "mp4";
export type DownloadQuality = "best";

export type DownloadPreset = {
  id: string;
  label: string;
  description: string;
  format: DownloadFormat;
  quality: DownloadQuality;
  kind: "audio" | "video";
  default?: boolean;
};

export const DEFAULT_DOWNLOAD_PRESET: DownloadPreset = {
  id: "mp3",
  label: "MP3",
  description: "Best quality audio",
  format: "mp3",
  quality: "best",
  kind: "audio",
  default: true,
};

export const DOWNLOAD_PRESETS: DownloadPreset[] = [
  DEFAULT_DOWNLOAD_PRESET,
  {
    id: "mp4",
    label: "MP4",
    description: "Direct from YouTube",
    format: "mp4",
    quality: "best",
    kind: "video",
  },
];

export function presetLabel(preset: DownloadPreset): string {
  return preset.label;
}

export function fallbackFilename(preset: DownloadPreset, count = 1): string {
  if (count > 1) return "tubetocd-playlist.zip";
  return `download.${preset.format}`;
}
