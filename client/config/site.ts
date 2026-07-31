export type SiteConfig = typeof siteConfig;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://tubetocd.com";

export const siteConfig = {
  name: "TubeToCD",
  shortName: "TubeToCD",
  tagline: "YouTube to your collection",
  description:
    "TubeToCD turns YouTube videos, playlists, and channels into clean MP3 and MP4 files. Preview audio, rename tracks, batch download, and keep a personal music library.",
  url: SITE_URL,
  locale: "en_US",
  keywords: [
    "YouTube to MP3",
    "YouTube to MP4",
    "download YouTube audio",
    "YouTube playlist download",
    "YouTube channel download",
    "MP3 converter",
    "YouTube music library",
    "TubeToCD",
    "tubetocd",
  ],
  ogImage: "/og.png",
  twitterHandle: "@tubetocd",
  supportEmail: "hello@tubetocd.com",
  nav: [
    { label: "Home", href: "/" },
    { label: "How it works", href: "/#how" },
    { label: "Features", href: "/#features" },
    { label: "Convert", href: "/pages/convert" },
  ] as const,
  footer: {
    product: [
      { label: "Home", href: "/" },
      { label: "How it works", href: "/#how" },
      { label: "Features", href: "/#features" },
      { label: "Convert", href: "/pages/convert" },
      { label: "Music desk", href: "/home" },
      { label: "Create account", href: "/pages/register" },
    ],
    legal: [
      { label: "Privacy", href: "/pages/privacy" },
      { label: "Terms", href: "/pages/terms" },
      { label: "Contact", href: "/pages/contact" },
    ],
  },
  links: {
    twitter: "https://x.com/tubetocd",
    github: "https://github.com",
  },
} as const;

/** Shared Open Graph / Twitter defaults for layout + pages. */
export function buildPageMetadata({
  title,
  description,
  path = "/",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
}) {
  const pageTitle = title
    ? `${title} · ${siteConfig.name}`
    : `${siteConfig.name} — ${siteConfig.tagline}`;
  const desc = description || siteConfig.description;
  const url = `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;

  return {
    title: title
      ? { absolute: pageTitle }
      : {
          default: `${siteConfig.name} — ${siteConfig.tagline}`,
          template: `%s · ${siteConfig.name}`,
        },
    description: desc,
    keywords: [...siteConfig.keywords],
    authors: [{ name: siteConfig.name, url: siteConfig.url }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    metadataBase: new URL(siteConfig.url),
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large" as const,
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type: "website" as const,
      locale: siteConfig.locale,
      url,
      siteName: siteConfig.name,
      title: pageTitle,
      description: desc,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} — ${siteConfig.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: pageTitle,
      description: desc,
      images: [siteConfig.ogImage],
      creator: siteConfig.twitterHandle,
    },
    applicationName: siteConfig.name,
    category: "music",
  };
}
