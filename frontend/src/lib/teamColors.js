// Team-color palette for NHL crests. Used to paint atmosphere behind
// matchup logos (glow, gradient edges) so My IQ / Tonight's 10 feels like
// hockey, not a dashboard.
//
// Values are approximate primary team colors — they are visual atmosphere,
// not brand-book exact. If a code is missing, callers should default to
// the Ticker blue #1e5dff.

export const TEAM_COLORS = {
  ANA: "#FC4C02", ARI: "#8C2633", BOS: "#FFB81C", BUF: "#003087",
  CGY: "#D50032", CAR: "#CE1126", CHI: "#CF0A2C", COL: "#6F263D",
  CBJ: "#00285C", DAL: "#006847", DET: "#CE1126", EDM: "#FF4C00",
  FLA: "#B9975B", LAK: "#111111", MIN: "#154734", MTL: "#AF1E2D",
  NSH: "#FFB81C", NJD: "#CE1126", NYI: "#00539B", NYR: "#0038A8",
  OTT: "#C52032", PHI: "#F74902", PIT: "#FCB514", SEA: "#001628",
  SJS: "#006D75", STL: "#002F87", TBL: "#002868", TOR: "#00205B",
  UTA: "#71AFE5", VAN: "#00205B", VGK: "#B4975A", WSH: "#C8102E",
  WPG: "#041E42",
};

// Slightly lighter “atmosphere” tone for radial gradients on dark
// backgrounds. Falls back to Ticker blue.
export function teamGlow(code) {
  return TEAM_COLORS[code] || "#1e5dff";
}
