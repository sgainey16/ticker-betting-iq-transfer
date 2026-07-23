// Portrait avatar for a host — uses the pre-cropped sprite from
// /api/sprites/{host}_neutral.png (or marc_explaining.png for Marc).
import { ANALYSTS } from "@/lib/config";
import { BACKEND_URL } from "@/lib/api";

export default function AnalystAvatar({
  analystId,
  size = 80,
  shape = "circle",
  ring = true,
  className = "",
}) {
  const a = ANALYSTS[analystId] || {};
  const src = a.portrait ? `${BACKEND_URL}${a.portrait}` : "";
  const style = {
    width: shape === "portrait" ? size * 0.8 : size,
    height: shape === "portrait" ? size : size,
    backgroundImage: src ? `url(${src})` : undefined,
    backgroundSize: "170%",
    backgroundPosition: "center 30%",
    backgroundRepeat: "no-repeat",
    borderRadius: shape === "circle" ? "999px" : "10px",
    border: ring ? `2px solid ${a.accent || "#2d2d35"}` : "none",
    boxShadow: ring && a.accent ? `0 0 20px -6px ${a.accent}` : "none",
    flexShrink: 0,
  };
  return <div className={className} style={style} aria-label={a.name || analystId} />;
}
