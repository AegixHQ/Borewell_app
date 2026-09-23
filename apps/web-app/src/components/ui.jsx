import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

export function Button({ children, variant = "dark", size, icon, trailing, block, className = "", ...rest }) {
  const classes = [
    "btn",
    variant !== "dark" ? variant : "",
    size || "",
    block ? "block" : "",
    trailing ? "has-trail" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
      {trailing && <span className="trail"><Icon name={trailing} size={16} strokeWidth={2.2} /></span>}
    </button>
  );
}

export function IconButton({ icon, label, dot, className = "", ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} {...rest}>
      <Icon name={icon} size={18} />
      {dot && (
        <span
          aria-hidden="true"
          style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: "50%", background: "var(--saffron)", border: "2px solid var(--surface)" }}
        />
      )}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone === "neutral" ? "" : tone}`}>{children}</span>;
}

export function Card({ children, tone, className = "", ...rest }) {
  return <section className={`card ${tone || ""} ${className}`} {...rest}>{children}</section>;
}

export function CardHead({ title, children }) {
  return (
    <div className="card-head">
      {title && <h2 className="title-md">{title}</h2>}
      {children}
    </div>
  );
}

export function Field({ label, hint, error, children, id }) {
  return (
    <div className={`field ${error ? "error" : ""}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {(error || hint) && <span className="hint">{error || hint}</span>}
    </div>
  );
}

export function TextInput({ id, ...rest }) {
  return <input id={id} className="input" {...rest} />;
}

export function Select({ id, options, ...rest }) {
  return (
    <select id={id} className="select" {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pills({ value, onChange, options }) {
  return (
    <div className="pills">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`pill ${value === o.value ? "active" : ""}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Alert({ children, tone = "error", onRetry, retryLabel = "Try again" }) {
  const map = { error: "", info: "info", ok: "ok" };
  return (
    <div className={`alert ${map[tone] || ""}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "error" ? "alert" : "info"} size={18} />
      <span>{children}</span>
      {onRetry && (
        <button type="button" className="link alert-action" onClick={onRetry}>{retryLabel}</button>
      )}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Dialog({ title, children, onClose, actions, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="card-head">
          <h2 className="title-md">{title}</h2>
          <div className="end"><IconButton icon="x" label="Close" onClick={onClose} /></div>
        </div>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose, busy, tone = "dark" }) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="light" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="ink2">{body}</p>
    </Dialog>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <span className="dot" aria-hidden="true" />
      {message}
    </div>
  );
}

export function KeyValue({ k, v }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
