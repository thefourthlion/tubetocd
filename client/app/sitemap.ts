import { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/pages/convert", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/pages/register", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/pages/login", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/pages/contact", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/pages/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/pages/terms", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return paths.map(({ path, priority, changeFrequency }) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
