"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Disc3,
  Download,
  Library,
  LogIn,
  LogOut,
  Search,
  Settings2,
  Wrench,
} from "lucide-react";
import { Logo } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";
import { DeskButton, DeskTab } from "@/components/desk/chrome";
import { TransfersPane } from "@/components/desk/transfers-pane";
import { getStoredUser, logout } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { useTransfers } from "@/lib/transfers";
import { formatSpeed } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Search YouTube", href: "/home", icon: Search },
  { label: "Convert Manually", href: "/pages/convert", icon: Wrench },
  { label: "Make a CD", href: "/pages/cd", icon: Disc3 },
  { label: "Library", href: "/pages/saved", icon: Library },
  { label: "Account", href: "/pages/account", icon: Settings2 },
] as const;

/**
 * The single application window. Every route except the marketing landing
 * renders inside it, so the desk is the app rather than one screen.
 */
export function DeskFrame({
  children,
  variant = "app",
}: {
  children: ReactNode;
  variant?: "app" | "plain";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const player = usePlayer();
  const transfers = useTransfers();
  const [transfersOpen, setTransfersOpen] = useState(true);

  useEffect(() => {
    const open = () => setTransfersOpen(true);
    window.addEventListener("tubetocd-transfers-open", open);
    return () => window.removeEventListener("tubetocd-transfers-open", open);
  }, []);

  const user = variant === "app" ? getStoredUser() : null;
  const activeTransfer = transfers.active[0] ?? null;

  return (
    <div className="relative z-10 min-h-screen text-foreground safe-area-insets">
      <div
        className={cn(
          "mx-auto w-full px-2 py-2 sm:px-3 sm:py-3",
          variant === "app" ? "max-w-[92rem]" : "max-w-3xl",
          // Only reserve room for the floating player when it is on screen.
          player.track ? "pb-32" : "pb-2 sm:pb-3",
        )}
      >
        <div
          className={cn(
            "lw-window flex flex-col",
            player.track
              ? "min-h-[calc(100dvh-9rem)]"
              : "min-h-[calc(100dvh-1.5rem)]",
          )}
        >
          <div className="lw-titlebar flex items-center gap-2 px-2.5 py-1.5">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
              title="Back to tubetocd.com"
            >
              <Logo size={20} />
              <span className="font-display text-sm font-bold tracking-tight text-foreground">
                TubeTo<span className="text-primary">CD</span>
              </span>
            </Link>
            <span className="hidden font-mono text-[0.65rem] text-muted-foreground sm:inline">
              — YouTube to your collection
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              {user && (
                <span className="hidden max-w-[12rem] truncate font-mono text-[0.65rem] text-muted-foreground md:inline">
                  {user.email}
                </span>
              )}
              <ThemeSwitch />
              {variant === "app" ? (
                <DeskButton
                  icon={<LogOut size={11} />}
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                >
                  <span className="hidden sm:inline">Log out</span>
                </DeskButton>
              ) : (
                <Link href="/pages/login">
                  <DeskButton icon={<LogIn size={11} />}>
                    <span className="hidden sm:inline">Log in</span>
                  </DeskButton>
                </Link>
              )}
            </div>
          </div>

          {variant === "app" && (
            <div className="lw-header flex items-end gap-1 overflow-x-auto px-2 pt-1.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active =
                  tab.href === "/home"
                    ? pathname === "/home"
                    : pathname.startsWith(tab.href);
                return (
                  <Link key={tab.href} href={tab.href} className="shrink-0">
                    <DeskTab active={active} icon={<Icon size={12} />}>
                      {tab.label}
                    </DeskTab>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">{children}</div>

          {variant === "app" && (
            <div className="border-t border-border/60 px-2 pb-2">
              <button
                type="button"
                onClick={() => setTransfersOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={transfersOpen}
              >
                <Download size={11} />
                Transfers ({transfers.transfers.length})
                {transfersOpen ? (
                  <ChevronDown size={12} className="ml-auto" />
                ) : (
                  <ChevronUp size={12} className="ml-auto" />
                )}
              </button>
              {transfersOpen && <TransfersPane />}
            </div>
          )}

          <div className="lw-statusbar mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-2.5 py-1 font-mono text-[0.62rem] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  transfers.active.length > 0
                    ? "animate-soft-pulse bg-primary"
                    : "bg-emerald-500",
                )}
              />
              {transfers.active.length > 0 ? "Transferring" : "Connected"}
            </span>
            <span>
              {activeTransfer
                ? `↓ ${formatSpeed(activeTransfer.rate) || "0 B/s"}`
                : "↓ 0 B/s"}
            </span>
            {variant === "app" && (
              <span>{transfers.transfers.length} transfers</span>
            )}
            <span className="ml-auto hidden truncate sm:inline">
              {player.track ? `Playing: ${player.track.title}` : "Player idle"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
