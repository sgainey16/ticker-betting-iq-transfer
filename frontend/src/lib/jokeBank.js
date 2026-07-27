// The Ticker — Joke Bank v1 (seed).
// Small tagged bank of Reggie & Marc character lines that Panel Show and
// Player Detail pull from. Every entry is one host's voice. Tagged by
// team code, position, and vibe so we can pick the right line for the
// player being displayed. Keeps humor in-character across the app instead
// of the LLM re-inventing tone on every render. Grow this weekly.
//
// vibe values:
//   star     — elite/franchise player, the guy people set alarms for
//   grinder  — third/fourth-line, character player, unsung
//   young    — early-career, rookie/second-year
//   vet      — mid-30s, has seen everything
//   goalie   — position-specific
//   rebuild  — bottom-of-league team context
//   contender — top-of-league team context
//   default  — safe fallback line for anyone

export const REGGIE_JOKES = [
  // Stars — awe + affection
  { vibe: "star",   text: "You know what you're getting with this guy. Show up, do the right things, drag the puck where nobody expects it to be. That's a HOCKEY player." },
  { vibe: "star",   text: "This is the kind of guy where you're doing the dishes, kid gets a two-on-one on the highlight, you drop the plate. Attaboy." },
  { vibe: "star",   text: "I'll say this. He plays like the puck owes him money. And it always pays." },

  // Grinders — respect, warmth
  { vibe: "grinder", text: "This is my guy. Doesn't show up on the highlight reel, shows up in the wins column. Every team needs three of him." },
  { vibe: "grinder", text: "You know what this guy does? He makes it hard on the guys we DO talk about. Simple beats fancy. Write it down." },

  // Young — encouragement, story
  { vibe: "young",  text: "Kid's just figuring it out. First half of the year he was thinking. Second half he's playing. Big difference. Watch him now." },
  { vibe: "young",  text: "I've seen this movie before. Confident young guy, veteran team, wrong side of a Tuesday game — he learns more that night than a whole camp." },

  // Vets — reverence
  { vibe: "vet",    text: "Come on now. You watch him and you realize he's been doing the RIGHT thing for fifteen years. That's not luck. That's a habit." },
  { vibe: "vet",    text: "Playoff hockey is boring hockey. Boring hockey wins. This guy IS boring hockey. And I love him for it." },

  // Goalies
  { vibe: "goalie", text: "You know what makes a goalie? The three guys he doesn't let you see. When his team plays the RIGHT way in front of him, he steals nights." },
  { vibe: "goalie", text: "Goalies are hockey's mood. He's the mood right now. Don't get fancy in front of him." },

  // Team-tinted — light context callbacks (still lightweight; expand later)
  { vibe: "default", team: "EDM", text: "Anything Edmonton is loud. He gets a shift with McDavid and the whole building holds its breath. That's a fun problem to have." },
  { vibe: "default", team: "TOR", text: "Every point in this jersey gets weighed twice. Fair? No. Real? Yes. He handles it." },
  { vibe: "default", team: "COL", text: "Avs play fast. He plays fast. It's a match. When Colorado has their legs, it's a HOCKEY problem for the other guys." },

  // Universal fallbacks
  { vibe: "default", text: "Kid can play. That's it. That's the whole take." },
  { vibe: "default", text: "There's a version of hockey where this guy is a household name. We're getting closer to that version every night." },
];

export const MARC_JOKES = [
  { vibe: "star",   text: "The sample is big enough now — this is who he is. And who he is happens to be very good. That's not an accident." },
  { vibe: "star",   text: "Interesting thing about players at this level: they don't have hot streaks and cold streaks. They have baseline and above-baseline." },
  { vibe: "star",   text: "I was waiting for the eye test and the tape to disagree on this one. They didn't. Everything points in the same direction." },

  { vibe: "grinder", text: "Watch the player without the puck. That's where this guy earns his shift. Coaches notice. Fans usually don't." },
  { vibe: "grinder", text: "The goal wasn't the story — the shift before the goal was. He was on that shift. That's not a coincidence." },

  { vibe: "young",  text: "One good year is a story. Two is a pattern. He's in year one — I'm watching. Not writing anything down yet." },
  { vibe: "young",  text: "Development takes years. Talent takes minutes. He's got the talent part. Now we watch the years." },

  { vibe: "vet",    text: "Veteran teams don't waste energy. He doesn't waste energy. There's a reason he's still in a top-six role at his age." },
  { vibe: "vet",    text: "Pressure reveals habits. His habits are old. That's a compliment where I come from." },

  { vibe: "goalie", text: "Goalie numbers need context. His workload is real. His team's structure is not perfect. He's holding up better than the surface suggests." },
  { vibe: "goalie", text: "One bad game shows up in the season stats forever. He's had his. He's also had the ones that saved a road trip. That's what I remember." },

  { vibe: "default", team: "EDM", text: "Edmonton's pace-of-play does two things: it makes their scorers look better and it makes their defenders' jobs harder. He lives on both sides of that." },
  { vibe: "default", team: "TOR", text: "The record says one thing. The underlying numbers say another. This roster's better than the mood suggests." },
  { vibe: "default", team: "COL", text: "The Avs' structure is what separates them. Talent + structure is a hard combination to beat. He fits both." },

  { vibe: "default", text: "The record hides what's actually happening. I'll say more once we see him against the top line." },
  { vibe: "default", text: "Small notes matter. He does small things right. That eventually shows up in the big things." },
];

// Deterministic picker so the same player always draws the same joke —
// keeps the app feeling stable across refreshes.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickJoke(pool, tags, seedStr) {
  const filtered = pool.filter((j) => {
    if (tags.team && j.team && j.team !== tags.team) return false;
    if (tags.vibe && j.vibe && j.vibe !== tags.vibe && j.vibe !== "default") return false;
    return true;
  });
  const bank = filtered.length ? filtered : pool.filter((j) => j.vibe === "default" && !j.team);
  const idx = hashSeed(seedStr) % Math.max(1, bank.length);
  return (bank[idx] || pool[0]).text;
}

export function vibeForPlayer(player) {
  const pos = (player.pos || "").toUpperCase();
  if (pos === "G") return "goalie";
  const gp = player.gp || 0;
  const pts = player.pts || 0;
  const ppg = gp ? pts / gp : 0;
  if (ppg >= 1.4) return "star";                         // elite forward
  if (pos === "D" && ppg >= 1.0) return "star";          // elite D (Makar-level)
  if (gp && gp < 30) return "young";
  if (pos === "D" && (player.blocks || 0) > 40 && ppg < 0.9) return "grinder";
  if (ppg < 0.6 && pos !== "D") return "grinder";
  return "vet";
}
