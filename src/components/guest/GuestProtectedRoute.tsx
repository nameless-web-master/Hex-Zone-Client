import { Navigate, useLocation } from "react-router-dom";
import { getGuestAccessToken } from "../../lib/guestAccessToken";

export default function GuestProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const token = getGuestAccessToken();
  if (!token) {
    const back =
      location.pathname + (location.search || "") + (location.hash || "");
    const search = new URLSearchParams();
    if (back && back !== "/access") search.set("from", back);
    const qs = search.toString();
    return <Navigate to={qs ? `/access?${qs}` : "/access"} replace />;
  }
  return children;
}
