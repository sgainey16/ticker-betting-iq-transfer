// One-tap plain-hockey explainer. Never clutters default UI — the "?"
// trigger stays quiet until tapped. Used across DESK, ROOM, HOST SPLIT,
// DELTA, and any future signal.
//
// Popover content comes from the caller so every term keeps a single
// source of truth. If we ever need i18n, one file to update.

import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function WhyChip({ label, title, body, testid }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testid || `why-${label?.toLowerCase()}`}
          aria-label={`Why ${title}?`}
          className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/[0.06] hover:bg-[#1e5dff]/30 text-white/40 hover:text-white transition-colors"
        >
          <HelpCircle className="w-3 h-3" strokeWidth={2.2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={8}
        className="w-64 bg-[#0a0a18] border border-white/15 text-white p-3 rounded-xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.9)]"
        data-testid={`why-popover-${label?.toLowerCase()}`}
      >
        <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-[#1e5dff] mb-1.5">
          Why {label}?
        </div>
        <div className="font-headline text-white text-[13px] leading-snug mb-1">
          {title}
        </div>
        <div className="text-white/70 text-[12px] leading-relaxed">{body}</div>
      </PopoverContent>
    </Popover>
  );
}
