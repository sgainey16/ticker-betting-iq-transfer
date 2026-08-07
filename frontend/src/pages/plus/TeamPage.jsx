// TeamPage — hyper-local team shrine, styled after the NHL Home V2 layout.
// Renders as much of the HomeV2 shape as our mock data supports; teams
// without a `stats` block fall back to a lighter card so nothing looks empty.
// Adds a division-mates chip row at the top so users can hop laterally to
// other team pages without going back up to the cascade.

import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import {
  ChevronLeft, MapPin, Ticket, ShoppingBag, Play, Star,
  Target, Shield, Zap, AlertTriangle, TrendingUp, TrendingDown,
  Radio, Quote,
} from "lucide-react";
import {
  teamByCode, prospectsForTeam, PACKAGES, rankPackages,
  CHL_DIVISIONS, NCAA_CONFERENCES,
} from "@/data/tickerCatalog";
import { useUserProfile } from "@/lib/userProfile";
import { PackageCard } from "@/components/plus/PackageCard";

// Given a team, find its siblings inside the same division/conference for
// the quick-switch chip row.
function siblingsOf(team) {
  if (!team) return [];
  for (const div of CHL_DIVISIONS) {
    if (div.teams.some(t => t.code === team.code)) return div.teams.filter(t => t.code !== team.code);
  }
  for (const conf of NCAA_CONFERENCES) {
    if (conf.teams.some(t => t.code === team.code)) return conf.teams.filter(t => t.code !== team.code);
  }
  return [];
}

const TONE_STYLES = {
  good: { icon: TrendingUp,   color: "text-emerald-400", ring: "border-emerald-500/25", bg: "bg-emerald-500/[0.06]" },
  bad:  { icon: TrendingDown, color: "text-rose-400",    ring: "border-rose-500/25",    bg: "bg-rose-500/[0.06]" },
  neut: { icon: Zap,          color: "text-white/70",    ring: "border-white/15",       bg: "bg-white/[0.03]" },
};

export default function TeamPage() {
  const { code } = useParams();
  const team = teamByCode(code);
  const { profile } = useUserProfile();

  const packages = useMemo(() => {
    if (!team) return [];
    const filtered = PACKAGES.filter(p => (p.teams || []).includes(team.code));
    return rankPackages(filtered, profile);
  }, [team, profile]);

  const prospects = useMemo(() => (team ? prospectsForTeam(team.code) : []), [team]);
  const siblings = useMemo(() => siblingsOf(team), [team]);

  if (!team) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-headline text-white text-2xl">Team not found</div>
          <Link to="/plus/your-ticker" className="mt-4 inline-block font-accent text-[10px] uppercase tracking-[0.28em] text-[#F58220]">← Back</Link>
        </div>
      </div>
    );
  }

  const hero = packages[0];
  const rest = packages.slice(1);
  const s = team.stats;

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      {/* Team-branded header band */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top left, ${team.primary}88 0%, transparent 60%)` }} />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <Link
            data-testid="team-back"
            to="/plus/your-ticker"
            className="inline-flex items-center gap-1.5 font-accent text-[9px] uppercase tracking-[0.28em] text-white/50 hover:text-white transition-colors mb-4"
          >
            <ChevronLeft className="w-3 h-3" /> Your Ticker
          </Link>

          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-headline text-white shadow-2xl"
              style={{ background: team.primary }}
            >
              <span className="text-lg md:text-xl">{team.code}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/80">
                {team.league} · {team.division || team.conference || ""}
              </div>
              <div className="font-headline text-white text-3xl md:text-4xl leading-tight">
                {team.name}
              </div>
              <div className="font-accent text-[11px] uppercase tracking-[0.24em] text-white/55 mt-1.5 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {team.city}
              </div>
            </div>
            {/* Record block, only when data present */}
            {s?.record && (
              <div className="hidden sm:flex flex-col items-end text-right">
                <div className="font-headline text-white text-2xl md:text-3xl leading-none">
                  {s.record.w}-{s.record.l}-{s.record.ot}
                </div>
                <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/55 mt-1">
                  {s.record.points} pts · {s.record.standing}
                </div>
                <div className="font-accent text-[10px] uppercase tracking-[0.24em] text-emerald-400 mt-0.5">{s.form}</div>
              </div>
            )}
          </div>

          {/* Three outbound CTAs */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <OutboundCta icon={Ticket} label="Tickets" detail="Next home game" testid="team-cta-tickets"
              href={`https://google.com/search?q=${encodeURIComponent(team.name + " tickets")}`}
              utm={`ticker_team_${team.code}_tickets`} color={team.primary} />
            <OutboundCta icon={Play} label="Watch tonight" detail="CHL TV / conference net" testid="team-cta-watch"
              href="https://watch.chl.ca/" utm={`ticker_team_${team.code}_watch`} color={team.primary} />
            <OutboundCta icon={ShoppingBag} label="Team store" detail="Jerseys, sweaters, gear" testid="team-cta-shop"
              href={`https://google.com/search?q=${encodeURIComponent(team.name + " jerseys shop")}`}
              utm={`ticker_team_${team.code}_shop`} color={team.primary} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">
        {/* Sibling team switcher — small logos, quick lateral hop */}
        {siblings.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/45 mr-1">
              Also in your division:
            </span>
            {siblings.map(t => (
              <Link
                key={t.code}
                data-testid={`team-switch-${t.code}`}
                to={`/plus/team/${t.code}`}
                className="group flex items-center gap-2 rounded-full border border-white/15 bg-black/40 pl-1.5 pr-3 py-1 hover:border-white/30 hover:bg-black/60 transition-all"
                title={t.name}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center font-headline text-[9px] text-white shadow"
                  style={{ background: t.primary }}
                >{t.code}</span>
                <span className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/75 group-hover:text-white">
                  {t.name.split(" ").slice(-1)[0]}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Reggie note — the coach's line, sets the tone */}
        {s?.reggieNote && (
          <section className="relative rounded-xl border border-white/10 bg-gradient-to-br from-black/60 via-transparent to-transparent p-5">
            <Quote className="absolute top-4 left-4 w-4 h-4 text-[#F58220]/50" />
            <div className="pl-8">
              <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220] mb-2">
                Reggie · Coach's read
              </div>
              <div className="font-headline text-white text-base md:text-lg leading-snug">
                "{s.reggieNote}"
              </div>
            </div>
          </section>
        )}

        {/* Team Identity tiles — mirrors HomeV2's "story" pillars */}
        {s?.identity?.length > 0 && (
          <section>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3">
              This team's identity
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {s.identity.map((row, i) => {
                const tone = TONE_STYLES[row.tone] || TONE_STYLES.neut;
                const Icon = tone.icon;
                return (
                  <div key={i} className={`rounded-lg border ${tone.ring} ${tone.bg} p-3.5`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className={`w-3.5 h-3.5 ${tone.color}`} />
                      <span className={`font-accent text-[9px] uppercase tracking-[0.28em] ${tone.color}`}>
                        {row.tone === "good" ? "Strength" : row.tone === "bad" ? "Watch out" : "Note"}
                      </span>
                    </div>
                    <div className="font-headline text-white text-base leading-tight">{row.label}</div>
                    <div className="font-accent text-[10px] uppercase tracking-[0.22em] text-white/55 mt-1">{row.detail}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Local Sponsor Slot */}
        <div className="rounded-xl border border-dashed border-[#F58220]/40 bg-[#F58220]/5 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#F58220]/20 border border-[#F58220]/40 flex items-center justify-center">
            <span className="font-headline text-[#F58220] text-sm">Ad</span>
          </div>
          <div className="flex-1">
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220]">Local sponsor slot</div>
            <div className="font-headline text-white text-sm mt-0.5">
              Reserved for a {team.city.split(",")[0]} business · Direct-sold · $500-1,500/mo
            </div>
          </div>
        </div>

        {/* Prospects */}
        {prospects.length > 0 && (
          <section>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-[#F58220]" /> Prospects to watch
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {prospects.map(p => (
                <Link
                  key={p.id}
                  data-testid={`team-prospect-${p.id}`}
                  to={`/plus/prospect/${p.id}`}
                  className="group rounded-lg border border-white/10 bg-black/40 p-4 hover:border-white/25 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-headline text-white text-lg leading-tight">{p.first} {p.last}</div>
                    <span className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/45 whitespace-nowrap">
                      {p.pos} · {p.age}
                    </span>
                  </div>
                  <div className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/50 mb-2">
                    {p.draftYear} · #{p.draftRank} · Orbit: {p.nhlOrbit.join(", ")}
                  </div>
                  <div className="text-white/75 text-[13px] leading-snug">{p.tagline}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Top story */}
        {hero && (
          <section>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#F58220]" /> Top story
            </div>
            <PackageCard pkg={hero.pkg} score={hero.score} variant="hero" />
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3">Recent</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rest.map(r => <PackageCard key={r.pkg.id} pkg={r.pkg} score={r.score} variant="compact" />)}
            </div>
          </section>
        )}

        {/* If no stats yet — one honest tile so the page never looks broken */}
        {!s && (
          <section className="rounded-xl border border-white/10 bg-black/30 p-5 text-center">
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/45 mb-2">
              Full team card coming
            </div>
            <div className="font-headline text-white text-lg">
              Live stats, identity tiles, and Reggie's coach-read arrive when the season data feed lands.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function OutboundCta({ icon: Icon, label, detail, href, utm, color, testid }) {
  const linkHref = href.includes("?") ? `${href}&utm_source=ticker&utm_campaign=${utm}` : `${href}?utm_source=ticker&utm_campaign=${utm}`;
  return (
    <a data-testid={testid} href={linkHref} target="_blank" rel="noopener noreferrer"
      className="group rounded-lg border border-white/15 bg-black/50 hover:bg-black/70 hover:border-white/30 p-3.5 flex items-center gap-3 transition-all">
      <div className="w-9 h-9 rounded-full flex items-center justify-center shadow" style={{ background: color }}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-headline text-white text-sm leading-tight">{label}</div>
        <div className="font-accent text-[9px] uppercase tracking-[0.24em] text-white/50">{detail}</div>
      </div>
    </a>
  );
}
