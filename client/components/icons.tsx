import * as React from "react";
import { IconSvgProps } from "@/types";
import { cn } from "@/lib/utils";

/** TubeToCD mark — lime wire through a platinum plate */
export const Logo: React.FC<IconSvgProps & { className?: string }> = ({
  size = 28,
  width,
  height,
  className,
  ...props
}) => (
  <svg
    fill="none"
    height={size || height}
    width={size || width}
    viewBox="0 0 32 32"
    className={cn("text-primary", className)}
    aria-hidden
    {...props}
  >
    <rect
      x="2"
      y="2"
      width="28"
      height="28"
      rx="7"
      className="fill-card stroke-border"
      strokeWidth="1.25"
    />
    <path
      d="M9 22 L14.5 10 L18 18 L23 10"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="23" cy="10" r="1.6" fill="currentColor" />
  </svg>
);

export const MoonFilledIcon = ({
  size = 20,
  width,
  height,
  ...props
}: IconSvgProps) => (
  <svg
    aria-hidden
    height={size || height}
    width={size || width}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M21.53 15.93c-.16-.27-.61-.69-1.73-.49a8.46 8.46 0 01-1.88.13 8.409 8.409 0 01-5.91-2.82 8.068 8.068 0 01-1.44-8.66c.44-1.01.13-1.54-.09-1.76s-.77-.55-1.83-.11a10.318 10.318 0 00-6.32 10.21 10.475 10.475 0 007.04 8.99 10 10 0 002.89.55c.16.01.32.02.48.02a10.5 10.5 0 008.47-4.27c.67-.93.49-1.519.32-1.79z" />
  </svg>
);

export const SunFilledIcon = ({
  size = 20,
  width,
  height,
  ...props
}: IconSvgProps) => (
  <svg
    aria-hidden
    height={size || height}
    width={size || width}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12 18a6 6 0 100-12 6 6 0 000 12zM12 2.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V3.25A.75.75 0 0112 2.5zm0 16.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM4.22 4.22a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06L4.22 5.28a.75.75 0 010-1.06zm13.44 13.44a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM2.5 12a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H3.25A.75.75 0 012.5 12zm16.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM4.22 19.78a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0zm13.44-13.44a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0z" />
  </svg>
);
