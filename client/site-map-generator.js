const sitemap = require("nextjs-sitemap-generator");
sitemap({
  baseUrl: "https://next-app.com/",
  ignoredPaths: ["admin", "login"],
  ignoredExtensions: [
    "js",
    "map",
    "json",
    "png",
    "jpeg",
    "jpg",
    "svg",
    "icon",
    "mp4",
  ],
  extraPaths: ["/extraPath"],
  pagesDirectory: __dirname + "/.next/server/pages",
  targetDirectory: "public/",
  sitemapFilename: "sitemap.xml",
  nextConfigPath: __dirname + "/next.config.js",
});
