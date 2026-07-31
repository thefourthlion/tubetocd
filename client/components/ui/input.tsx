import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, hint, error, leftIcon, rightSlot, id, ...props },
    ref,
  ) => {
    const inputId = id || React.useId();

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            "lw-inset group relative flex items-center gap-2",
            "transition-colors duration-150",
            "focus-within:border-primary/60",
            error && "border-destructive/60",
          )}
        >
          {leftIcon && (
            <span className="pointer-events-none absolute left-2.5 text-muted-foreground transition-colors group-focus-within:text-primary">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-9 w-full bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/70",
              "outline-none disabled:cursor-not-allowed disabled:opacity-50",
              leftIcon ? "pl-8" : "pl-2.5",
              rightSlot ? "pr-9" : "pr-2.5",
              className,
            )}
            {...props}
          />
          {rightSlot && (
            <span className="absolute right-2 flex items-center">{rightSlot}</span>
          )}
        </div>
        {(hint || error) && (
          <p
            className={cn(
              "font-mono text-[0.65rem]",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, id, ...props }, ref) => {
    const areaId = id || React.useId();
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={areaId}
            className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            "lw-inset min-h-[88px] w-full resize-y px-2.5 py-2",
            "font-mono text-xs text-foreground placeholder:text-muted-foreground/70",
            "outline-none transition-colors duration-150 focus:border-primary/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        {hint && (
          <p className="font-mono text-[0.65rem] text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
