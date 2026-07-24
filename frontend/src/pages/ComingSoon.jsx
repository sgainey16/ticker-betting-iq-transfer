import { useParams, Link } from "react-router-dom";
import { UPCOMING } from "@/lib/upcoming";
import { ArrowLeft, Crown, Radio } from "lucide-react";

export default function ComingSoon() {
  const { slug } = useParams();
  const meta = UPCOMING[slug];

  if (!meta) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <div className="font-headline text-3xl text-white">Not found</div>
        <Link to="/" className="mt-4 inline-block text-[#1e5dff] font-accent uppercase tracking-widest text-sm">
          Back to broadcast →
        </Link>
      </div>
    );
  }

  const showsAccuracy = meta.kind === "game";

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid={`coming-soon-${slug}`}>
      <Link
        to="/press-conference"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Presser
      </Link>

      <header
        className="rounded-2xl p-8 border relative overflow-hidden"
        style={{
          borderColor: meta.accent + "55",
          background: `linear-gradient(135deg, ${meta.accent}18 0%, transparent 55%), #0d0d13`,
        }}
      >
        <div
          className="font-accent text-[11px] uppercase tracking-[0.4em] mb-2"
          style={{ color: meta.accent }}
        >
          {meta.kicker}
        </div>
        <h1 className="font-headline text-4xl sm:text-5xl text-white leading-none">
          {meta.title}
        </h1>
        <p className="mt-4 text-white/70 text-base sm:text-lg leading-relaxed max-w-2xl">
          {meta.blurb}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-white/15">
          <Radio className="w-3.5 h-3.5 text-[#1e5dff] live-pulse" />
          <span className="font-accent text-[10px] uppercase tracking-widest text-white/75">
            Ships when the founder says <span className="text-white">"{meta.trigger}"</span>
          </span>
        </div>
      </header>

      {showsAccuracy && meta.stats && (
        <section className="card-surface p-5">
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60 mb-4">
            Your record
          </div>
          <div className="grid grid-cols-2 gap-3">
            {meta.stats.map((s, i) => (
              <div
                key={i}
                className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-4"
                data-testid={`coming-soon-stat-${i}`}
              >
                <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
                  {s.label}
                </div>
                <div
                  className="font-headline text-4xl mt-1"
                  style={{ color: meta.accent }}
                >
                  {s.value}
                </div>
                <div className="text-[11px] font-accent uppercase tracking-widest text-white/40 mt-0.5">
                  {s.sub}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[11px] font-accent uppercase tracking-widest text-white/35 text-center">
            Accuracy shows the moment your first pick locks
          </div>
        </section>
      )}

      <section className="card-surface p-5">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-4 h-4 text-[#1e5dff]" />
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
            Founding Member perk
          </div>
        </div>
        <div className="text-white/75 text-sm">
          Founders get early access the moment this feature ships. If you're already in, you'll see it here first.
        </div>
      </section>
    </div>
  );
}
