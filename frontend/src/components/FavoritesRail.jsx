// FavoritesRail — small horizontal row of the fan's favorite teams pinned
// to the top of Home. Each logo taps into the team's stat/highlights page:
//   NHL   → /team/:code       (TeamStatPage — the auto-generated depth chart)
//   CHL   → /plus/team/:code  (TeamPage — packages + prospects for junior teams)
//   NCAA  → /plus/team/:code  (same TeamPage — handles NCAA too via catalog)
//
// Behavior:
//   - If the user has no favorites, we auto-render their onboarded NHL team
//     so the rail is never empty. That single logo is the anchor.
//   - Max 4 logos. If they want more, the "+" opens the mini team-picker.
//   - The picker suggests CHL/NCAA teams tied to the user's NHL team via
//     `nhlAffinity`, plus the top-of-league list otherwise.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X, Check } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { useUserProfile } from "@/lib/userProfile";
import {
  suggestJuniorTeamsForNhl,
  suggestNcaaTeamsForNhl,
  CHL_DIVISIONS,
  NCAA_CONFERENCES,
} from "@/data/tickerCatalog";

const MAX_LOGOS = 4;

// Resolve the deep-link route for a given favorite entry.
function routeFor(fav) {
  if (fav.league === "NHL") return `/team/${fav.code}`;
  return `/plus/team/${fav.code}`;
}

// Turn the flat profile fields into an ordered list of favorites capped at
// MAX_LOGOS. NHL first (that's the emotional anchor), then CHL, then NCAA.
function buildFavorites(profile) {
  if (!profile) return [];
  const items = [];
  if (profile.nhl_team) items.push({ code: profile.nhl_team, league: "NHL" });
  (profile.chl_teams || []).forEach(c => items.push({ code: c, league: "CHL" }));
  (profile.ncaa_teams || []).forEach(c => items.push({ code: c, league: "NCAA" }));
  return items.slice(0, MAX_LOGOS);
}

// Look up a team's display name across catalogs so the picker shows humans
// what they're adding, not just three-letter codes.
function nameFor(code, league) {
  if (league === "CHL") {
    for (const div of CHL_DIVISIONS) {
      const t = div.teams.find(x => x.code === code);
      if (t) return { name: t.name, city: t.city };
    }
  }
  if (league === "NCAA") {
    for (const conf of NCAA_CONFERENCES) {
      const t = conf.teams.find(x => x.code === code);
      if (t) return { name: t.name, city: t.city };
    }
  }
  return { name: code, city: "" };
}

export function FavoritesRail() {
  const { profile, updateProfile } = useUserProfile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const favorites = useMemo(() => buildFavorites(profile), [profile]);
  const remainingSlots = Math.max(0, MAX_LOGOS - favorites.length);

  // If the fan hasn't onboarded and has no NHL team either, we hide the rail
  // — the Welcome banner is doing the CTA work in that state.
  if (!profile?.nhl_team && favorites.length === 0) return null;

  return (
    <>
      <div
        className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 flex items-center gap-2 overflow-hidden"
        data-testid="home-favorites-rail"
      >
        <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/45 flex-shrink-0 pr-2 border-r border-white/10">
          My Teams
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {favorites.map((fav) => (
            <Link
              key={`${fav.league}-${fav.code}`}
              to={routeFor(fav)}
              data-testid={`home-favorite-${fav.league}-${fav.code}`}
              className="group relative h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: fav.league === "NHL"
                  ? "1px solid rgba(30,93,255,0.55)"
                  : "1px solid rgba(255,255,255,0.12)",
              }}
              title={`${fav.code} · ${fav.league}`}
            >
              <TeamLogo code={fav.code} size={26} monogramClass="!bg-transparent" />
              <span
                className="absolute -bottom-1 -right-1 rounded-sm px-1 py-[1px] leading-none font-accent"
                style={{
                  fontSize: "7px",
                  letterSpacing: "0.14em",
                  background: fav.league === "NHL" ? "#1e5dff" : fav.league === "CHL" ? "#F58220" : "#a855f7",
                  color: "#0b0b10",
                  fontWeight: 700,
                }}
              >
                {fav.league}
              </span>
            </Link>
          ))}
          {/* Add-more slot — only when we can still fit another logo. Opens
           * a lightweight modal (below) instead of routing away to onboarding
           * so the fan keeps their place on Home. */}
          {remainingSlots > 0 && (
            <button
              onClick={() => setPickerOpen(true)}
              data-testid="home-favorites-add"
              className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 border border-dashed border-white/20 text-white/50 hover:border-[#F58220] hover:text-[#F58220] transition-colors"
              title="Add a favorite team"
              aria-label="Add favorite team"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {pickerOpen && (
        <TeamPickerModal
          profile={profile}
          onClose={() => setPickerOpen(false)}
          onToggle={(code, league) => {
            const key = league === "CHL" ? "chl_teams" : "ncaa_teams";
            const list = profile?.[key] || [];
            const next = list.includes(code)
              ? list.filter(c => c !== code)
              : [...list, code];
            updateProfile({ [key]: next });
          }}
        />
      )}
    </>
  );
}

// ---- Mini team-picker modal --------------------------------------------
// Kept intentionally lightweight: suggestions come from `nhlAffinity`
// (junior/college teams whose feeder pipeline points at the user's NHL
// team). If nothing matches, we show a couple of broad league picks so the
// user can still add a favorite.
function TeamPickerModal({ profile, onClose, onToggle }) {
  const nhl = profile?.nhl_team;

  const suggestedChl = useMemo(() => {
    if (!nhl) return CHL_DIVISIONS[0]?.teams?.slice(0, 6) || [];
    const tied = suggestJuniorTeamsForNhl(nhl);
    return (tied.length ? tied : CHL_DIVISIONS[0]?.teams || []).slice(0, 8);
  }, [nhl]);

  const suggestedNcaa = useMemo(() => {
    if (!nhl) return NCAA_CONFERENCES[0]?.teams?.slice(0, 6) || [];
    const tied = suggestNcaaTeamsForNhl(nhl);
    return (tied.length ? tied : NCAA_CONFERENCES[0]?.teams || []).slice(0, 8);
  }, [nhl]);

  const isPicked = (code, league) => {
    const list = league === "CHL" ? profile?.chl_teams : profile?.ncaa_teams;
    return (list || []).includes(code);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="home-favorites-picker"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#0f0f16] p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
          aria-label="Close"
          data-testid="home-favorites-picker-close"
        >
          <X className="w-4 h-4" />
        </button>
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220]">
            Add a favorite
          </div>
          <div className="font-headline text-white text-2xl mt-1" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
            {nhl ? `Junior + college tied to ${nhl}` : "Pick a team to follow"}
          </div>
          <div className="text-white/50 text-xs mt-1">
            Tap to toggle. Ask Reggie for anything outside these suggestions.
          </div>
        </div>

        {/* CHL block */}
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/55 mb-2">
            CHL · Junior
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {suggestedChl.map((t) => (
              <PickerRow key={t.code} team={t} league="CHL" picked={isPicked(t.code, "CHL")} onToggle={onToggle} />
            ))}
          </div>
        </div>

        {/* NCAA block */}
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/55 mb-2">
            NCAA · College
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {suggestedNcaa.map((t) => (
              <PickerRow key={t.code} team={t} league="NCAA" picked={isPicked(t.code, "NCAA")} onToggle={onToggle} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PickerRow({ team, league, picked, onToggle }) {
  return (
    <button
      onClick={() => onToggle(team.code, league)}
      data-testid={`home-favorites-picker-${league}-${team.code}`}
      className={`text-left rounded-lg px-2.5 py-2 flex items-center gap-2 transition-all border ${
        picked
          ? "border-[#F58220] bg-[#F58220]/10"
          : "border-white/10 bg-black/30 hover:border-white/25"
      }`}
    >
      <div
        className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${team.primary || "#1e5dff"}22`, border: `1px solid ${team.primary || "#1e5dff"}55` }}
      >
        <TeamLogo code={team.code} size={22} monogramClass="!bg-transparent" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white text-[13px] font-headline truncate" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
          {team.name}
        </div>
        <div className="text-white/45 text-[10px] font-accent uppercase tracking-widest truncate">
          {team.code} · {team.city?.split(",")[1]?.trim() || team.city || ""}
        </div>
      </div>
      {picked && <Check className="w-3.5 h-3.5 text-[#F58220] flex-shrink-0" />}
    </button>
  );
}
