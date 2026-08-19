import { Info } from "lucide-react";
import { cn } from "./cn";

type InfoTooltipProps = {
  text: string;
  className?: string;
};

export function InfoTooltip({ text, className }: InfoTooltipProps) {
  return (
    <span
      tabIndex={0}
      className={cn(
        "group/tooltip relative inline-flex cursor-help items-center align-middle text-zinc-400 outline-none hover:text-zinc-600 focus-visible:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 dark:focus-visible:text-zinc-300",
        className
      )}
    >
      <Info className="size-3.5" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-normal normal-case text-zinc-600 opacity-0 shadow-md transition-opacity duration-100 group-hover/tooltip:opacity-100 group-focus-visible/tooltip:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {text}
      </span>
    </span>
  );
}
