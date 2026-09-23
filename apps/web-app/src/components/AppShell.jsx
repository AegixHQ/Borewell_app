import { NavLink, useNavigate } from "react-router-dom";
import Icon, { Logo } from "./Icon.jsx";
import { IconButton } from "./ui.jsx";
import { useSession } from "../lib/session.jsx";

const NAV = {
  customer: [
    { to: "/customer", label: "My jobs", end: true },
    { to: "/customer/new", label: "New request" },
  ],
  contractor: [
    { to: "/contractor", label: "Overview", end: true },
    { to: "/contractor/rigs", label: "Find rigs" },
    { to: "/contractor/bookings", label: "Bookings" },
    { to: "/contractor/pricing", label: "Pricing" },
    { to: "/contractor/areas", label: "Areas" },
  ],
  resource_owner: [
    { to: "/owner", label: "Overview", end: true },
    { to: "/owner/fleet", label: "Fleet" },
    { to: "/owner/requests", label: "Requests" },
  ],
};

export default function AppShell({ children }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const items = NAV[session.role] || NAV.contractor;
  const initials = (session.email || "?").slice(0, 2).toUpperCase();

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <header className="topnav">
        <div className="topnav-inner">
          <span className="brand"><Logo /> borewell</span>
          <nav className="tabs" aria-label="Sections">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-right">
            <span className="avatar" title={session.email}>{initials}</span>
            <IconButton icon="logout" label="Sign out" onClick={handleSignOut} />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, back, actions }) {
  return (
    <div className="page-head">
      <div className="stack" style={{ gap: 6 }}>
        {back && (
          <NavLink to={back.to} className="back">
            <Icon name="chevronLeft" size={15} /> {back.label}
          </NavLink>
        )}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="title-xl">{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
