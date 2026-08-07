// Division / Conference cascade page.
// One reusable page rendering either a WHL division (e.g. BC) or an NCAA
// conference (Big Ten / Hockey East). Routes:
//   /plus/chl/:division   → WHL divisions (uses CHL_DIVISIONS lookup)
//   /plus/ncaa/:conf      → NCAA conferences (uses NCAA_CONFERENCES lookup)

import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
import { CHL_DIVISIONS, NCAA_CONFERENCES, PACKAGES, rankPackages } from "@/data/tickerCatalog";
import { useUserProfile } from "@/lib/userProfile";
import { PackageCard } from "@/components/plus/PackageCard";

function findDivision(kind, code) {
  if (kind === "chl") return CHL_DIVISIONS.find(d => d.code.toLowerCase() === code.toLowerCase());
  if (kind === "ncaa") return NCAA_CONFERENCES.find(c => c.code.toLowerCase() === code.toLowerCase());
  return null;
}

export default function DivisionPage({ kind }) {
  const { division, conf } = useParams();
  const code = kind === "chl" ? division : conf;
  const div = findDivision(kind, code || "");
  const { profile } = useUserProfile();

  const ranked = useMemo(() => {
    if (!div) return [];
    const teamSet = new Set(div.teams.map(t => t.code));
    const filtered = PACKAGES.filter(p => (p.teams || []).some(t => teamSet.has(t)));
    return rankPackages(filtered, profile);
  }, [div, profile]);

  if (!div) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-headline text-white text-2xl">Division not found</div>
          <Link to="/plus/your-ticker" className="mt-4 inline-block font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220]">
            ← Back to Your Ticker
          </Link>
        </div>
      </div>
    );
  }

  const hero = ranked[0];
  const rest = ranked.slice(1);
  const leagueLabel = kind === "chl" ? "WHL" : "NCAA";

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">
        <Link
          data-testid="div-back"
          to="/plus/your-ticker"
          className="inline-flex items-center gap-1.5 font-accent text-[9px] uppercase tracking-[0.28em] text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3 h-3" /> Your Ticker
        </Link>

        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220]">
            {leagueLabel} · {div.code}
          </div>
          <div className="font-headline text-white text-4xl md:text-5xl leading-tight mt-1.5">
            {div.name}
          </div>
          <div className="font-accent text-[11px] uppercase tracking-[0.24em] text-white/55 mt-2">
            {div.teams.length} teams · {ranked.length} packages this week
          </div>
        </div>

        {/* Teams grid */}
        <section>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3">Teams</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {div.teams.map(t => (
              <Link
                key={t.code}
                data-testid={`div-team-${t.code}`}
                to={`/plus/team/${t.code}`}
                className="group rounded-lg border border-white/10 bg-black/40 p-3 hover:border-white/25 transition-all"
                style={{ borderTopColor: t.primary, borderTopWidth: 3 }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-headline text-[10px] text-white shadow" style={{ background: t.primary }}>
                    {t.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-headline text-white text-sm leading-tight truncate">{t.name.split(" ").slice(-1)[0]}</div>
                    <div className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/45 truncate flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" /> {t.city.split(",")[0]}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Hero + feed */}
        {hero && (
          <section>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3">Top story</div>
            <PackageCard pkg={hero.pkg} score={hero.score} variant="hero" />
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3">This week</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rest.map(r => <PackageCard key={r.pkg.id} pkg={r.pkg} score={r.score} variant="compact" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
