// YourTicker — the personalized dashboard.
// Post-onboarding home. Reads the profile, runs the Ranker over the mock
// package catalog, and renders a cascade:
//
//   Hero:       highest-ranked package for this user
//   For You:    top 4 packages (excluding hero)
//   Your Teams: quick chips into their teams
//   Prospects:  followed prospects tile row
//   From The League:  a wider WHL feed
//   From College:     a wider NCAA feed
//
// If the visitor hasn't onboarded, we soft-redirect via CTA (not a hard
// redirect, so they can still poke around).

import { Link, Navigate } from "react-router-dom";
import { useMemo } from "react";
import { Compass, Star, TrendingUp, RefreshCw } from "lucide-react";
import { useUserProfile } from "@/lib/userProfile";
import { PACKAGES, PROSPECTS, rankPackages, teamByCode, suggestJuniorTeamsForNhl, suggestNcaaTeamsForNhl } from "@/data/tickerCatalog";
import { PackageCard } from "@/components/plus/PackageCard";
import { TeamLogo } from "@/components/plus/TeamLogo";

export default function YourTicker() {
  const { profile, isOnboarded, clearProfile } = useUserProfile();

  const ranked = useMemo(() => rankPackages(PACKAGES, profile), [profile]);

  if (!isOnboarded) return <Navigate to="/plus/onboarding" replace />;

  const hero = ranked[0];
  const forYou = ranked.slice(1, 5);
  const whlFeed = ranked.filter(r => r.pkg.league === "WHL").slice(0, 6);
  const ncaaFeed = ranked.filter(r => r.pkg.league === "NCAA").slice(0, 4);

  const myTeams = [
    ...(profile.chl_teams || []),
    ...(profile.ncaa_teams || []),
  ].map(teamByCode).filter(Boolean);

  const myProspects = (profile.prospects || [])
    .map(id => PROSPECTS.find(p => p.id === id))
    .filter(Boolean);

  // Quick-switch logos row — surfaces up to 6 team shortcuts near the very
  // top of the home. Prefers user's own teams first, then blends in a couple
  // suggested ones from the same NHL orbit so the row is always populated
  // even for a user who skipped the team-picking onboarding steps.
  const quickTeams = (() => {
    const own = myTeams.slice(0, 4);
    if (own.length >= 4) return own;
    const seen = new Set(own.map(t => t.code));
    // Fill from the same NHL affinity across CHL + NCAA.
    const suggest = [
      ...(profile.nhl_team ? suggestJuniorTeamsForNhl(profile.nhl_team) : []),
      ...(profile.nhl_team ? suggestNcaaTeamsForNhl(profile.nhl_team) : []),
    ].filter(t => !seen.has(t.code)).slice(0, 4 - own.length);
    return [...own, ...suggest];
  })();

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">
        {/* Personalized header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220]">
              Your Ticker · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </div>
            <div className="font-headline text-white text-3xl md:text-4xl leading-tight mt-1">
              Morning, <span className="text-[#F58220]">{profile.nickname || "friend"}</span>.
            </div>
            <div className="font-accent text-[11px] uppercase tracking-[0.22em] text-white/55 mt-1.5">
              Reggie and Marc pulled tonight's desk. Top of your feed first.
            </div>
          </div>
          <Link
            data-testid="yt-edit-desk"
            to="/plus/onboarding"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 font-accent text-[9px] uppercase tracking-[0.28em] text-white/70 hover:border-white/30 hover:text-white transition-colors"
            onClick={(e) => {
              if (!window.confirm("Redo onboarding? Your current picks stay saved until you commit new ones.")) e.preventDefault();
            }}
          >
            <RefreshCw className="w-3 h-3" /> Rebuild desk
          </Link>
        </div>

        {/* Quick team switcher — small logos near the top for lateral hop.
            Own teams first, then affinity-suggested teams to keep the row full. */}
        {quickTeams.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap -mt-2">
            <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/45">
              Quick switch:
            </span>
            {quickTeams.map(t => (
              <Link
                key={t.code}
                data-testid={`yt-quick-${t.code}`}
                to={`/plus/team/${t.code}`}
                className="group flex items-center gap-2 rounded-full border border-white/12 bg-black/40 pl-1.5 pr-3 py-1 hover:border-white/30 hover:bg-black/60 transition-all"
              >
                <TeamLogo team={t} size={22} className="border border-white/15" />
                <span className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/75 group-hover:text-white">
                  {t.name.split(" ").slice(-1)[0]}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Hero package */}
        {hero && (
          <section>
            <SectionTitle icon={TrendingUp} label="Top of your desk" />
            <PackageCard pkg={hero.pkg} score={hero.score} variant="hero" />
          </section>
        )}

        {/* For You grid */}
        {forYou.length > 0 && (
          <section>
            <SectionTitle icon={Compass} label="For you" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {forYou.map(r => <PackageCard key={r.pkg.id} pkg={r.pkg} score={r.score} variant="compact" />)}
            </div>
          </section>
        )}

        {/* Your Teams chips */}
        {myTeams.length > 0 && (
          <section>
            <SectionTitle label="Your teams" />
            <div className="flex flex-wrap gap-2.5">
              {myTeams.map(t => (
                <Link
                  key={t.code}
                  data-testid={`yt-team-${t.code}`}
                  to={`/plus/team/${t.code}`}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 pl-2 pr-4 py-1.5 hover:border-white/30 hover:bg-black/60 transition-all"
                >
                  <TeamLogo team={t} size={24} />
                  <span className="font-accent text-[10px] uppercase tracking-[0.24em] text-white/85">{t.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Prospects row */}
        {myProspects.length > 0 && (
          <section>
            <SectionTitle icon={Star} label="Your prospects" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myProspects.map(p => (
                <Link
                  key={p.id}
                  data-testid={`yt-prospect-${p.id}`}
                  to={`/plus/prospect/${p.id}`}
                  className="group rounded-lg border border-white/10 bg-black/40 hover:border-white/25 p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-headline text-white text-lg leading-tight">{p.first} {p.last}</div>
                    <span className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/45 whitespace-nowrap">
                      {p.pos} · {p.age}
                    </span>
                  </div>
                  <div className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/50 mb-2">
                    {p.juniorTeam ? `WHL · ${p.juniorTeam}` : `NCAA · ${p.ncaaTeam}`} · {p.draftYear} · #{p.draftRank}
                  </div>
                  <div className="text-white/70 text-[13px] leading-snug">{p.tagline}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* From the WHL feed */}
        {whlFeed.length > 0 && (
          <section>
            <SectionTitle label="From the WHL" href="/plus/chl/bc" />
            <div className="rounded-xl border border-white/10 bg-black/30 divide-y divide-white/8">
              {whlFeed.map(r => <PackageCard key={r.pkg.id} pkg={r.pkg} score={r.score} variant="list" />)}
            </div>
          </section>
        )}

        {/* From college */}
        {ncaaFeed.length > 0 && (
          <section>
            <SectionTitle label="From college" href="/plus/ncaa/big-ten" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ncaaFeed.map(r => <PackageCard key={r.pkg.id} pkg={r.pkg} score={r.score} variant="compact" />)}
            </div>
          </section>
        )}

        {/* Reset (dev/demo aid, safe to remove) */}
        <div className="pt-6 border-t border-white/8">
          <button
            data-testid="yt-clear-profile"
            onClick={() => {
              if (window.confirm("Reset your Ticker desk? This clears your teams, prospects, and nickname.")) clearProfile();
            }}
            className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/30 hover:text-white/70 transition-colors"
          >
            Clear desk (demo reset)
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ label, icon: Icon, href }) {
  const content = (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#F58220]" />}
      <span className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85">{label}</span>
      {href && <span className="ml-auto font-accent text-[9px] uppercase tracking-[0.28em] text-white/40 hover:text-white transition-colors">See all →</span>}
    </div>
  );
  if (href) return <Link to={href}>{content}</Link>;
  return content;
}
