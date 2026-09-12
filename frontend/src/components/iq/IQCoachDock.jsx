// IQCoachDock — Reggie + Marc portraits with a contextual coaching line
// baked into every Hockey IQ tab. Not a decorative flourish — tapping the
// dock opens an inline conversation grounded in the current context.
//
// Modes:
//   "tonight"      → Reggie prompts you toward locking a call
//   "my-iq"        → Marc reads the Phase 3 coaching line
//   "fantasy"      → Reggie asks about roster
//   "community"    → Marc frames the consensus/specialist split
//
// Composition follows HostPortrait's DuoRow pattern: Reggie on the left,
// Marc mirrored on the right so their gazes meet at the copy in between.

import { useState } from "react";
import HostPortrait from "@/components/HostPortrait";
import IQCoachChat from "@/components/iq/IQCoachChat";
import { MessageSquare, Sparkles } from "lucide-react";

const MODE_META = {
  tonight:   { kicker: "Reggie + Marc · on the desk",   speaker: "reggie", role: "prompt" },
  "my-iq":   { kicker: "Marc · reading your record",     speaker: "marc",   role: "coach"  },
  fantasy:   { kicker: "Reggie · your team is up",       speaker: "reggie", role: "prompt" },
  community: { kicker: "Marc · reading the room",        speaker: "marc",   role: "coach"  },
};

export default function IQCoachDock({
  mode = "tonight",
  line,                 // string — the current contextual line
  suggestions = [],     // array of quick-reply strings for the chat entry
  deviceId,
  seedMessage,          // optional string prefilled into chat when opened
  compact = false,
}) {
  const meta = MODE_META[mode] || MODE_META.tonight;
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div
      className="relative rounded-2xl bg-gradient-to-br from-[#0e1533]/70 via-[#0a0a1e]/70 to-[#050510]/70 border border-white/10 overflow-hidden"
      data-testid={`iq-coach-dock-${mode}`}
    >
      <div className={`flex items-stretch ${compact ? "gap-2 p-2.5" : "gap-3 p-3 sm:p-4"}`}>
        {/* Left — Reggie */}
        <HostPortrait
          persona="reggie"
          size={compact ? 68 : 84}
          showName={false}
          className="rounded-lg flex-shrink-0"
        />

        {/* Middle — kicker + line */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="font-accent text-[9px] sm:text-[10px] uppercase tracking-[0.28em] text-[#1e5dff] mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> {meta.kicker}
          </div>
          <div className="text-white text-sm sm:text-[15px] leading-snug font-headline">
            {line}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              data-testid={`iq-coach-dock-${mode}-talk`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e5dff]/15 hover:bg-[#1e5dff]/30 border border-[#1e5dff]/40 text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
            >
              <MessageSquare className="w-3 h-3" /> Talk to {meta.speaker === "marc" ? "Marc" : "Reggie"}
            </button>
            {suggestions.slice(0, 2).map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChatOpen(true)}
                data-testid={`iq-coach-dock-${mode}-suggest-${i}`}
                className="px-2.5 py-1 rounded-full bg-black/30 hover:bg-white/10 border border-white/10 hover:border-white/30 text-white/80 font-accent text-[10px] uppercase tracking-widest transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Right — Marc, mirrored to look inward */}
        <HostPortrait
          persona="marc"
          size={compact ? 68 : 84}
          showName={false}
          mirror
          className="rounded-lg flex-shrink-0"
        />
      </div>

      {chatOpen && (
        <IQCoachChat
          deviceId={deviceId}
          mode={mode}
          seedMessage={seedMessage}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
