import { Link } from "react-router-dom";
import { TEST_IDS } from "@/lib/config";
import { ArrowUpRight } from "lucide-react";

export default function AnalystCard({ analyst, index = 0 }) {
  const { id, name, short, role, accent, tagline, image } = analyst;

  return (
    <div
      data-testid={TEST_IDS.home.analystCard(id)}
      className="analyst-card card-surface overflow-hidden group relative"
      style={{
        borderColor: "#2d2d35",
      }}
    >
      {/* Signature color rail */}
      <div
        className="absolute top-0 left-0 h-full w-1"
        style={{ background: accent, boxShadow: `0 0 24px ${accent}` }}
      />

      <div className="relative">
        <div className="aspect-[4/5] w-full overflow-hidden bg-[#0b0b10] broadcast-stripe">
          <img
            src={image}
            alt={`${name} portrait`}
            className="w-full h-full object-cover object-top opacity-95 group-hover:opacity-100 transition-opacity"
            loading={index < 2 ? "eager" : "lazy"}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(180deg, transparent 40%, rgba(13,13,17,0.85) 100%)`,
            }}
          />
        </div>

        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded font-accent text-[10px] uppercase tracking-[0.2em]"
          style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
        >
          {role}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-headline text-2xl text-white leading-tight">
            {short}
          </h3>
          <span className="font-accent text-xs text-white/40 uppercase tracking-widest">
            #{String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-white/50">{name}</div>
        <p className="mt-3 text-sm text-white/70 leading-relaxed min-h-[3rem]">
          {tagline}
        </p>

        <Link
          to={`/ask?analyst=${id}`}
          data-testid={TEST_IDS.home.analystAskBtn(id)}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full font-accent text-xs uppercase tracking-widest text-black transition-transform duration-300 hover:-translate-y-0.5"
          style={{ background: accent, boxShadow: `0 8px 24px -8px ${accent}` }}
        >
          Put {short} on the mic
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
