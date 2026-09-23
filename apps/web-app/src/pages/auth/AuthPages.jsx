import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { login, registerAccount, PLATFORM_SPINE_URL } from "shared-ui";
import { Logo } from "../../components/Icon.jsx";
import { Alert, Button, Field, Segmented, TextInput } from "../../components/ui.jsx";
import DepthGauge from "../../components/DepthGauge.jsx";
import { HOME_FOR_ROLE, useSession } from "../../lib/session.jsx";
import { useAction } from "../../lib/hooks.js";

const DEMO = import.meta.env.VITE_DEMO === "1";
const DEMO_LOGINS = [
  { email: "selvi@demo.in", label: "Customer" },
  { email: "senthil@demo.in", label: "Contractor" },
  { email: "murugan@demo.in", label: "Rig owner" },
];

function AuthLayout({ children }) {
  return (
    <div className="auth">
      <div className="auth-hero">
        <span className="brand" style={{ color: "#fff" }}><Logo size={40} /> borewell</span>
        <h1>Know the depth before you dig.</h1>
        <p>Location-based quotes, nearby rigs and live drilling updates for Madurai district.</p>
        <div className="pills chips">
          <span className="chip-dark hot">KALLIKUDI · PILOT AREA</span>
          <span className="chip-dark">RAZORPAY CHECKOUT</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 36, justifyContent: "flex-end" }}>
        <div className="gauge-wrap"><DepthGauge min={380} max={520} water={440} height={520} width={120} dark /></div>
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { session, signIn } = useSession();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (session) return <Navigate to={HOME_FOR_ROLE[session.role] || "/customer"} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    await run(async () => {
      // Role is never asked for at sign-in - platform-spine returns it and
      // it is decoded from the JWT (ADR-0002).
      const { access_token: token } = await login(PLATFORM_SPINE_URL, email, password);
      signIn({ token, email });
      navigate("/", { replace: true });
    });
  }

  return (
    <AuthLayout>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="title-lg">Sign in</h1>
        <p className="muted">New here? <Link to="/register" className="link">Create an account</Link></p>
      </div>
      <form className="stack" onSubmit={handleSubmit} style={{ gap: 14 }}>
        <Field label="Email" id="login-email">
          <TextInput id="login-email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" id="login-password">
          <TextInput id="login-password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" block trailing="arrowRight" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        {DEMO && (
          <div className="inset stack" style={{ gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Demo mode — pick an account (any password)</span>
            <div className="pills">
              {DEMO_LOGINS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="pill"
                  onClick={() => { setEmail(account.email); setPassword("demo1234"); }}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </AuthLayout>
  );
}

const ROLE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "contractor", label: "Contractor" },
  { value: "resource_owner", label: "Rig owner" },
];

export function RegisterPage() {
  const { session, signIn } = useSession();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  if (session) return <Navigate to={HOME_FOR_ROLE[session.role] || "/customer"} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    await run(async () => {
      const { access_token: token } = await registerAccount(PLATFORM_SPINE_URL, { email, password, phone, role });
      signIn({ token, email });
      navigate("/", { replace: true });
    });
  }

  const roleLabel = ROLE_OPTIONS.find((r) => r.value === role).label.toLowerCase();

  return (
    <AuthLayout>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="title-lg">Create account</h1>
        <p className="muted">Already have one? <Link to="/login" className="link">Sign in</Link></p>
      </div>
      <form className="stack" onSubmit={handleSubmit} style={{ gap: 14 }}>
        {/* Role is chosen once, here, and never asked for again (ADR-0002). */}
        <Segmented label="I am joining as" value={role} onChange={setRole} options={ROLE_OPTIONS} />
        <Field label="Email" id="reg-email">
          <TextInput id="reg-email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Phone" id="reg-phone" hint="Optional">
          <TextInput id="reg-phone" type="tel" autoComplete="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="+91 " />
        </Field>
        <Field label="Password" id="reg-password" hint="At least 8 characters">
          <TextInput id="reg-password" type="password" autoComplete="new-password" minLength={8} required
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" block trailing="arrowRight" disabled={busy}>
          {busy ? "Creating…" : `Create ${roleLabel} account`}
        </Button>
        <p className="hint">Your role decides which workspace you see. It can’t be changed at sign-in.</p>
      </form>
    </AuthLayout>
  );
}
