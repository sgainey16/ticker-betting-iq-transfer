// Deterministic mock sportsbook lines. Same game ID always renders the
// same numbers, so refreshes / re-renders don't jitter. When we wire
// Highlightly's real /odds endpoint, `mockLine` gets swapped for a
// fetch and every consumer (ticker + per-card chip) picks up the truth.

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function mockLine(gameId) {
  const h = hashString(gameId || "");
  const homeFav = (h % 100) < 65;
  const favMag  = 105 + (h % 116);
  const dogMag  = 100 + ((h >> 3) % 106);
  const totals  = [5.5, 6.0, 6.5, 7.0];
  return {
    favSide:    homeFav ? "home" : "away",
    favOdds:    `-${favMag}`,
    dogOdds:    `+${dogMag}`,
    total:      totals[(h >> 6) % totals.length].toFixed(1),
    totalSide:  (h >> 9) % 2 === 0 ? "O" : "U",
    totalOdds:  (h >> 11) % 2 === 0 ? "-105" : "-115",
  };
}
