// ProspectPage — the deepest fandom surface, and where the paywall lives.
// Free tier: identity, tagline, one dev-story paragraph, orbit teams
// Paywalled ("Ticker+ · Go Deeper"): full scout report, film notes, comps

import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { ChevronLeft, TrendingUp, MapPin, Radio } from "lucide-react";
import { PROSPECTS, PACKAGES, rankPackages, teamByCode } from "@/data/tickerCatalog";
import { useUserProfile } from "@/lib/userProfile";
import { PackageCard } from "@/components/plus/PackageCard";
import { GoDeeper } from "@/components/plus/GoDeeper";
import { TeamLogo } from "@/components/plus/TeamLogo";

export default function ProspectPage() {
  const { id } = useParams();
  const p = PROSPECTS.find(x => x.id === id);
  const { profile } = useUserProfile();

  const packages = useMemo(() => {
    if (!p) return [];
    const filtered = PACKAGES.filter(pkg => (pkg.prospects || []).includes(p.id));
    return rankPackages(filtered, profile);
  }, [p, profile]);

  if (!p) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-headline text-white text-2xl">Prospect not found</div>
          <Link to="/plus/your-ticker" className="mt-4 inline-block font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220]">← Back</Link>
        </div>
      </div>
    );
  }

  const team = teamByCode(p.juniorTeam || p.ncaaTeam);
  const primary = team?.primary || "#F58220";

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top right, ${primary}88 0%, transparent 60%)` }} />
        <div className="relative max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <Link
            data-testid="prospect-back"
            to="/plus/your-ticker"
            className="inline-flex items-center gap-1.5 font-accent text-[9px] uppercase tracking-[0.28em] text-white/50 hover:text-white transition-colors mb-4"
          >
            <ChevronLeft className="w-3 h-3" /> Your Ticker
          </Link>

          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center font-headline text-white shadow-2xl"
                style={{ background: primary }}
              >
                <span className="text-2xl md:text-3xl">{p.last[0]}{p.first[0]}</span>
              </div>
              {team && <TeamLogo team={team} size={28} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/80 flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-[#F58220]" />
                Prospect · {p.pos} · Age {p.age}
              </div>
              <div className="font-headline text-white text-4xl md:text-5xl leading-[1.05]">
                {p.first} {p.last}
              </div>
              <div className="font-accent text-[11px] uppercase tracking-[0.24em] text-white/55 mt-2 flex items-center gap-2 flex-wrap">
                {team && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {team.city}</span>}
                <span>·</span>
                <span>{team?.name || (p.juniorTeam ? `WHL ${p.juniorTeam}` : `NCAA ${p.ncaaTeam}`)}</span>
                <span>·</span>
                <span>{p.draftYear} Draft · #{p.draftRank}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 font-headline text-white text-lg md:text-xl leading-snug max-w-2xl">
            {p.tagline}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/50">NHL orbit:</span>
            {p.nhlOrbit.map(code => (
              <span
                key={code}
                className={`inline-flex items-center rounded-full px-2.5 py-1 font-accent text-[10px] uppercase tracking-[0.22em] ${profile.nhl_team === code ? "bg-[#F58220] text-black" : "bg-white/10 text-white/75"}`}
              >
                {code}
              </span>
            ))}
            {profile.nhl_team && p.nhlOrbit.includes(profile.nhl_team) && (
              <span className="font-accent text-[10px] uppercase tracking-[0.28em] text-emerald-400">
                · could be yours
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">
        {/* "About this league" — for the visitor who's never watched
         * junior/college and just clicked a name from Beyond the NHL.
         * Educational, not condescending. Two sentences max. */}
        <section className="rounded-lg border border-white/10 bg-black/30 p-4">
          <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220] mb-1.5">
            About this league
          </div>
          <div className="text-white/80 text-[13px] leading-snug">
            {p.juniorTeam ? (
              <>
                <span className="text-white">WHL (Western Hockey League)</span> — one of three Canadian Hockey League branches (WHL · OHL · QMJHL).
                Feeds directly into the NHL Draft; roughly a third of active NHL players came through the CHL.
                Kids play against pros-in-training from age 16 to 20.
              </>
            ) : (
              <>
                <span className="text-white">NCAA Division I</span> — the American college route to the NHL.
                Roughly 30% of NHL rosters are NCAA alumni. Players stay in school 1-4 years while developing;
                many are drafted while still in college.
              </>
            )}
          </div>
        </section>

        {/* Free tier development story */}
        <section>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3">Development story</div>
          <div className="text-white/85 text-[15px] leading-relaxed max-w-2xl">
            {p.developmentStory}
          </div>
        </section>

        {/* Paywalled deep-dive — the highest-intent moment */}
        <GoDeeper
          title={`The full ${p.last} scout report`}
          previewLines={[
            "Every private film note from Reggie & Marc's tape sessions",
            "Comps to current NHL players by shot chart + skating profile",
            "Where he ranks against his class in each of 12 skill categories",
            "The one weakness scouts flag most, and how he's addressing it",
          ]}
          cta="Unlock the full report"
        />

        {/* Packages featuring this prospect */}
        {packages.length > 0 && (
          <section>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#F58220]" /> Recent packages
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {packages.map(r => <PackageCard key={r.pkg.id} pkg={r.pkg} score={r.score} variant="compact" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
