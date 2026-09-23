import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import { HOME_FOR_ROLE, useSession } from "./lib/session.jsx";
import { LoginPage, RegisterPage } from "./pages/auth/AuthPages.jsx";
import CustomerHome from "./pages/customer/CustomerHome.jsx";
import CustomerJob from "./pages/customer/CustomerJob.jsx";
import NewRequest from "./pages/customer/NewRequest.jsx";
import ContractorOverview from "./pages/contractor/ContractorOverview.jsx";
import ContractorJob from "./pages/contractor/ContractorJob.jsx";
import FindRigs from "./pages/contractor/FindRigs.jsx";
import Bookings from "./pages/contractor/Bookings.jsx";
import PricingRules from "./pages/contractor/PricingRules.jsx";
import ServiceAreas from "./pages/contractor/ServiceAreas.jsx";
import { OwnerFleet, OwnerOverview, OwnerRequests } from "./pages/owner/OwnerPages.jsx";

/**
 * Role-based routing is PRESENTATION ONLY (ADR-0002 / apps/AGENTS.md).
 * Every service enforces access with require_role() server-side; a user who
 * types another role's URL gets the screen but the API refuses the data.
 */
function RequireRole({ roles, children }) {
  const { session } = useSession();
  const location = useLocation();
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(session.role)) {
    return <Navigate to={HOME_FOR_ROLE[session.role] || "/customer"} replace />;
  }
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const { session } = useSession();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/customer" element={<RequireRole roles={["customer"]}><CustomerHome /></RequireRole>} />
      <Route path="/customer/new" element={<RequireRole roles={["customer"]}><NewRequest /></RequireRole>} />
      <Route path="/customer/jobs/:jobId" element={<RequireRole roles={["customer"]}><CustomerJob /></RequireRole>} />

      {/* admin has no dedicated console yet - it lands on the contractor view */}
      <Route path="/contractor" element={<RequireRole roles={["contractor", "admin"]}><ContractorOverview /></RequireRole>} />
      <Route path="/contractor/jobs/:jobId" element={<RequireRole roles={["contractor", "admin"]}><ContractorJob /></RequireRole>} />
      <Route path="/contractor/rigs" element={<RequireRole roles={["contractor", "admin"]}><FindRigs /></RequireRole>} />
      <Route path="/contractor/rigs/:jobId" element={<RequireRole roles={["contractor", "admin"]}><FindRigs /></RequireRole>} />
      <Route path="/contractor/bookings" element={<RequireRole roles={["contractor", "admin"]}><Bookings /></RequireRole>} />
      <Route path="/contractor/pricing" element={<RequireRole roles={["contractor", "admin"]}><PricingRules /></RequireRole>} />
      <Route path="/contractor/areas" element={<RequireRole roles={["contractor", "admin"]}><ServiceAreas /></RequireRole>} />

      <Route path="/owner" element={<RequireRole roles={["resource_owner"]}><OwnerOverview /></RequireRole>} />
      <Route path="/owner/fleet" element={<RequireRole roles={["resource_owner"]}><OwnerFleet /></RequireRole>} />
      <Route path="/owner/requests" element={<RequireRole roles={["resource_owner"]}><OwnerRequests /></RequireRole>} />

      <Route path="*" element={<Navigate to={session ? HOME_FOR_ROLE[session.role] || "/customer" : "/login"} replace />} />
    </Routes>
  );
}
