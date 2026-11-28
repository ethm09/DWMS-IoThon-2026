import { Link } from "react-router-dom";
export default function DwmsLogo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return <Link to="/" aria-label="DWMS home" className="inline-flex items-center gap-2 shrink-0">
    <img src="/brand/mark.svg" alt="" width="34" height="38" />
    {!compact && <span className="leading-tight"><strong className={`block text-xl tracking-tight ${light ? "text-white" : "text-[#0B2039]"}`}>DWMS</strong><span className={`text-[11px] font-medium ${light ? "text-slate-300" : "text-[#52697C]"}`}>Water Intelligence</span></span>}
  </Link>;
}
