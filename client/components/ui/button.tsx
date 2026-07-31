import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "font-mono font-bold uppercase tracking-[0.06em] select-none",
    "transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "lw-bevel-primary",
        secondary: "lw-bevel text-foreground",
        ghost: "lw-bevel border-transparent bg-none text-muted-foreground hover:text-foreground",
        outline: "lw-bevel text-muted-foreground hover:text-foreground",
        danger: "lw-bevel border-destructive/50 text-destructive",
        soft: "lw-bevel text-foreground",
      },
      size: {
        sm: "h-7 px-2.5 text-[0.65rem]",
        md: "h-8 px-3 text-[0.7rem]",
        lg: "h-10 px-4 text-[0.75rem]",
        icon: "h-8 w-8 p-0",
        "icon-sm": "h-7 w-7 p-0",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin-wire"
            aria-hidden
          />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
