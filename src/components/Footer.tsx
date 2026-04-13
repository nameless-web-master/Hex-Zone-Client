import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="flex flex-col gap-4 border-t border-slate-800/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div className="flex items-center justify-center gap-2 sm:justify-start">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#00E5D1]"
        aria-hidden
      />
      <span className="text-sm font-medium text-white">Zone Weaver</span>
    </div>
    <p className="text-center text-xs text-slate-500 sm:flex-1">
      H3 Geospatial Indexing + REST API
    </p>
    <div className="flex items-center justify-center gap-6 sm:justify-end">
      <Link
        to="/api"
        className="text-xs text-slate-500 transition hover:text-[#00E5D1]"
      >
        API
      </Link>
    </div>
  </footer>
);
