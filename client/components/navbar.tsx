"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { isAuthenticated, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-changed", sync);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleAuthAction = () => {
    if (authed) {
      logout();
      setAuthed(false);
      router.push("/");
    } else {
      router.push("/pages/login");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="absolute inset-0 border-b border-border/60 bg-background/75 backdrop-blur-xl" />
      <nav className="relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <Logo
              size={28}
              className="transition-transform duration-300 ease-apple group-hover:scale-105"
            />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              TubeTo<span className="text-primary">CD</span>
            </span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {siteConfig.nav.map((item) => {
              const isHash = item.href.includes("#");
              const active = isHash
                ? false
                : item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium",
                      "transition-all duration-200 ease-apple",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-2 -bottom-[0.85rem] h-0.5 rounded-full bg-primary sm:-bottom-[1.1rem]" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <ThemeSwitch />
          {authed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/home")}
            >
              Open desk
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/pages/register")}
            >
              Sign up
            </Button>
          )}
          <Button
            variant={authed ? "ghost" : "primary"}
            size="sm"
            onClick={handleAuthAction}
          >
            {authed ? "Log out" : "Log in"}
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <ThemeSwitch />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg",
              "border border-border/70 bg-card text-foreground",
              "transition-all duration-200 ease-apple active:scale-95",
            )}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>

      <div
        className={cn(
          "relative overflow-hidden border-b border-border/60 bg-background/95 backdrop-blur-xl sm:hidden",
          "transition-all duration-300 ease-apple",
          open ? "max-h-[28rem] opacity-100" : "max-h-0 border-transparent opacity-0",
        )}
      >
        <div className="flex flex-col gap-1 px-4 py-3">
          {siteConfig.nav.map((item) => {
            const isHash = item.href.includes("#");
            const active = isHash
              ? false
              : item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {authed ? (
            <Link
              href="/home"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Open desk
            </Link>
          ) : (
            <Link
              href="/pages/register"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Sign up
            </Link>
          )}
          <button
            type="button"
            onClick={handleAuthAction}
            className="mt-1 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {authed ? "Log out" : "Log in"}
          </button>
        </div>
      </div>
    </header>
  );
}
