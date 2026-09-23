import { useState } from "react";
import { Link } from "react-router-dom";
import {
  RESOURCE_NETWORK_URL, listBookings, formatRelative, shortId,
  BOOKING_STATUS_LABELS, bookingTone,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon from "../../components/Icon.jsx";
import { Alert, Badge, Card, EmptyState, Loading, Pills } from "../../components/ui.jsx";
import { useLoad } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Declined" },
];

export default function Bookings() {
  const { session } = useSession();
  const [filter, setFilter] = useState("all");
  const bookings = useLoad(() => listBookings(RESOURCE_NETWORK_URL, session.token), [session.token], { pollMs: 30000 });

  const list = (bookings.data || []).filter((b) => filter === "all" || b.status === filter);
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, f.value === "all" ? (bookings.data || []).length : (bookings.data || []).filter((b) => b.status === f.value).length])
  );

  return (
    <main className="page">
      <PageHeader title="Rig bookings" subtitle="Requests you've sent to rig owners." />
      {bookings.error && <Alert onRetry={bookings.reload}>{bookings.error.message}</Alert>}

      <Card className="stack">
        <Pills value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} />

        {bookings.loading && !bookings.data && <Loading label="Loading bookings…" />}

        {bookings.data && list.length === 0 && (
          <EmptyState icon="calendar" title="No requests here">
            Find a rig near a job site and send the owner a booking request - it shows up here with its status.
          </EmptyState>
        )}

        {list.map((b) => (
          <div key={b.booking_id} className="list-row" style={{ cursor: "default" }}>
            <span className="tile-icon"><Icon name="truck" /></span>
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>
                {b.job_id ? <Link to={`/contractor/jobs/${b.job_id}`} className="link">{shortId(b.job_id)}</Link> : "No job attached"}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                Rig <span className="mono">{b.resource_id.slice(0, 8)}</span>
                {b.message ? ` · “${b.message}”` : ""}
              </span>
            </span>
            <span className="end stack" style={{ marginLeft: "auto", alignItems: "flex-end", gap: 4 }}>
              <Badge tone={bookingTone(b.status)}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
              <span className="muted" style={{ fontSize: 12 }}>
                {formatRelative(b.responded_at || b.created_at)}
              </span>
            </span>
          </div>
        ))}
      </Card>
    </main>
  );
}
