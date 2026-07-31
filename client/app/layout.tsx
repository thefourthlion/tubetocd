import "@/styles/globals.scss";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { buildPageMetadata, siteConfig } from "@/config/site";
import { fontDisplay, fontMono, fontSans } from "@/config/fonts";
import { ShellGate } from "@/components/shell/ShellGate";

export const metadata: Metadata = {
  ...buildPageMetadata({ path: "/" }),
  title: {
    default: `${siteConfig.name} — YouTube to MP3 & MP4`,
    template: `%s · ${siteConfig.name}`,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eaef" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "min-h-screen font-sans antialiased",
          fontSans.variable,
          fontDisplay.variable,
          fontMono.variable,
        )}
      >
        <Providers
          themeProps={{
            attribute: "class",
            defaultTheme: "system",
            enableSystem: true,
          }}
        >
          <div className="atmosphere" aria-hidden />
          <ShellGate>{children}</ShellGate>
          <Toaster
            richColors
            closeButton
            position="bottom-right"
            toastOptions={{
              className:
                "!bg-card !text-card-foreground !border-border !shadow-panel dark:!shadow-panel-dark",
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
