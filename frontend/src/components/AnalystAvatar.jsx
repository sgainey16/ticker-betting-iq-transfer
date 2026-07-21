// Crop the actual desk photo to show one analyst per avatar.
// Positions calibrated from the reference image (1536x1024).
import { ANALYSTS } from "@/lib/config";

const DESK_IMAGE =
  "https://customer-assets-39nsmqrw.emergentagent.net/job_sports-broadcast-21/artifacts/w55umj8m_710626E9-E6C1-45DB-8CC2-0F51791FBB4B.png";

// bg-position pct for each analyst (calibrated for background-size ~ 460%)
const POS = {
  marchetti: { x: 6, y: 44 },
  doyle: { x: 34, y: 44 },
  kovalenko: { x: 65, y: 44 },
  lindqvist: { x: 92, y: 44 },
};

export default function AnalystAvatar({
  analystId,
  size = 80,
  shape = "circle", // 'circle' | 'square' | 'portrait'
  ring = true,
  className = "",
}) {
  const p = POS[analystId] || POS.doyle;
  const a = ANALYSTS[analystId] || {};
  const style = {
    width: shape === "portrait" ? size * 0.8 : size,
    height: shape === "portrait" ? size : size,
    backgroundImage: `url(${DESK_IMAGE})`,
    backgroundSize: "460%",
    backgroundPosition: `${p.x}% ${p.y}%`,
    backgroundRepeat: "no-repeat",
    borderRadius: shape === "circle" ? "999px" : "10px",
    border: ring ? `2px solid ${a.accent || "#2d2d35"}` : "none",
    boxShadow: ring && a.accent ? `0 0 20px -6px ${a.accent}` : "none",
    flexShrink: 0,
  };
  return <div className={className} style={style} aria-label={a.name || analystId} />;
}
