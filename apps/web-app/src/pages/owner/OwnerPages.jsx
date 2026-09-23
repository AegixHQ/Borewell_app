import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RESOURCE_NETWORK_URL, listMyResources, createResource, updateResource,
  listBookings, acceptBooking, rejectBooking,
  formatInr, formatRelative, PILOT_CENTER, formatCoords,
  RESOURCE_TYPES, RESOURCE_STATUS_LABELS, resourceStatusTone,
  BOOKING_STATUS_LABELS, bookingTone,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon from "../../components/Icon.jsx";
import SiteMap from "../../components/SiteMap.jsx";
import {
  Alert, Badge, Button, Card, CardHead, Dialog, EmptyState, Field, KeyValue,
  Loading, Pills, Select, TextInput, Toast,
} from "../../components/ui.jsx";
import { useAction, useLoad, useToast } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

function useOwnerData() {
  const { session } = useSession();
  const resources = useLoad(() => listMyResources(RESOURCE_NETWORK_URL, session.token), [session.token], { pollMs: 30000 });
  const bookings = useLoad(() => listBookings(RESOURCE_NETWORK_URL, session.token), [session.token], { pollMs: 20000 });
  return { resources, bookings };
}

export function OwnerOverview() {
  const navigate = useNavigate();
  const { resources, bookings } = useOwnerData();
  const [toast, setToast] = useToast();

  const list = resources.data || [];
  const pending = (bookings.data || []).filter((b) => b.status === "pending");
  const available = list.filter((r) => r.status === "available" && r.lat !== null && r.lat !== undefined);
  const missingLocation = list.filter((r) => r.lat === null || r.lat === undefined);

  return (
    <main className="page">
      <PageHeader
        title="Your fleet"
        subtitle={pending.length
          ? `${pending.length} contractor ${pending.length === 1 ? "request is" : "requests are"} waiting for an answer`
          : "No requests waiting right now"}
        actions={<Button icon="plus" onClick={() => navigate("/owner/fleet")}>List equipment</Button>}
      />

      {resources.error && <Alert onRetry={resources.reload}>{resources.error.message}</Alert>}

      <div className="kpis">
        <div className="kpi hero">
          <div className="kpi-top">
            <span>Requests waiting</span>
            <span className="kpi-icon"><Icon name="inbox" size={18} strokeWidth={2.2} /></span>
          </div>
          <div className="kpi-val">
            <b>{pending.length}</b>
            <span className="kpi-sub">{pending.length ? `oldest ${formatRelative(pending[pending.length - 1].created_at)}` : "all clear"}</span>
          </div>
        </div>
        <SimpleKpi label="Listed" value={list.length} sub="rigs, equipment & crew" icon="truck" />
        <SimpleKpi label="Visible in search" value={`${available.length} of ${list.length}`} sub={missingLocation.length ? `${missingLocation.length} missing a location` : "all located"} icon="eye" />
        <SimpleKpi label="In use" value={list.filter((r) => r.status === "in_use" || r.status === "assigned").length} sub="out on a job" icon="calendar" />
      </div>

      <div className="split">
        <RequestsPanel bookings={bookings} resources={resources} onToast={setToast} />
        <Card className="stack">
          <CardHead title="Fleet" >
            <div className="end"><Button variant="light" size="sm" onClick={() => navigate("/owner/fleet")}>Manage</Button></div>
          </CardHead>
          {resources.loading && !resources.data && <Loading />}
          {list.length === 0 && (
            <EmptyState icon="truck" title="Nothing listed yet"
              action={<Button icon="plus" onClick={() => navigate("/owner/fleet")}>List equipment</Button>}>
              Contractors can only find rigs that are listed, available and have a location set.
            </EmptyState>
          )}
          {list.slice(0, 5).map((r) => (
            <div key={r.resource_id} className="list-row" style={{ cursor: "default" }}>
              <span className="tile-icon"><Icon name="truck" /></span>
              <span className="stack" style={{ gap: 0 }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span className="muted" style={{ fontSize: 13 }}>{r.vehicle_type || RESOURCE_TYPES.find((t) => t.value === r.resource_type)?.label}</span>
              </span>
              <span className="end stack" style={{ marginLeft: "auto", alignItems: "flex-end", gap: 2 }}>
                <span className="num" style={{ fontWeight: 700 }}>{r.hourly_rate ? `${formatInr(r.hourly_rate)}/hr` : "—"}</span>
                <Badge tone={resourceStatusTone(r.status)}>{RESOURCE_STATUS_LABELS[r.status]}</Badge>
              </span>
            </div>
          ))}
        </Card>
      </div>
      <Toast message={toast} />
    </main>
  );
}

function SimpleKpi({ label, value, sub, icon }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon"><Icon name={icon} size={18} /></span>
      </div>
      <div className="kpi-val">
        <b>{value}</b>
        <span className="kpi-sub">{sub}</span>
      </div>
    </div>
  );
}

function RequestsPanel({ bookings, resources, onToast, showAll = false }) {
  const { session } = useSession();
  const action = useAction();
  const [filter, setFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState(null);

  const all = useMemo(() => bookings.data || [], [bookings.data]);
  const list = useMemo(
    () => (showAll ? all.filter((b) => filter === "all" || b.status === filter) : all.filter((b) => b.status === "pending")),
    [all, filter, showAll]
  );
  const selected = list.find((b) => b.booking_id === selectedId) || list[0] || null;

  function resourceFor(booking) {
    return (resources.data || []).find((r) => r.resource_id === booking.resource_id);
  }

  async function respond(booking, accept) {
    await action.run(
      async () => {
        if (accept) await acceptBooking(RESOURCE_NETWORK_URL, session.token, booking.booking_id);
        else await rejectBooking(RESOURCE_NETWORK_URL, session.token, booking.booking_id);
        onToast(accept ? "Booking accepted" : "Request declined");
        await Promise.all([bookings.reload(), resources.reload({ quiet: true })]);
      },
      {
        onError: (err) => (err.code === "RESOURCE_NO_LONGER_AVAILABLE"
          ? "That rig isn't available any more, so this request can't be accepted."
          : err.message),
      }
    );
  }

  return (
    <div className="stack">
      <Card className="stack">
        <CardHead title="Booking requests">
          {!showAll && list.length > 0 && <span className="tag-mono" style={{ background: "var(--saffron)" }}>{list.length} NEW</span>}
        </CardHead>

        {showAll && (
          <Pills
            value={filter}
            onChange={setFilter}
            options={[
              { value: "pending", label: "Pending", count: all.filter((b) => b.status === "pending").length },
              { value: "accepted", label: "Accepted", count: all.filter((b) => b.status === "accepted").length },
              { value: "rejected", label: "Declined", count: all.filter((b) => b.status === "rejected").length },
              { value: "all", label: "All", count: all.length },
            ]}
          />
        )}

        {bookings.loading && !bookings.data && <Loading />}
        {bookings.error && <Alert onRetry={bookings.reload}>{bookings.error.message}</Alert>}

        {bookings.data && list.length === 0 && (
          <EmptyState icon="inbox" title="Nothing waiting">
            When a contractor requests one of your listings, it appears here to accept or decline.
          </EmptyState>
        )}

        {list.map((b) => {
          const res = resourceFor(b);
          return (
            <button
              key={b.booking_id}
              type="button"
              className={`list-row ${selected?.booking_id === b.booking_id ? "active" : ""}`}
              onClick={() => setSelectedId(b.booking_id)}
            >
              <span className="avatar soft"><Icon name="briefcase" size={18} /></span>
              <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{res ? res.name : "A listing of yours"}</span>
                <span className="muted" style={{ fontSize: 13 }}>Contractor request · {formatRelative(b.created_at)}</span>
              </span>
              <span className="end" style={{ marginLeft: "auto" }}>
                <Badge tone={bookingTone(b.status)}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
              </span>
            </button>
          );
        })}
      </Card>

      {selected && (
        <Card tone="dark" className="stack">
          <div className="card-head" style={{ margin: 0 }}>
            <span className="muted">Request received</span>
            <div className="end muted" style={{ fontSize: 13 }}>{formatRelative(selected.created_at)}</div>
          </div>
          <h2 className="title-md">{resourceFor(selected)?.name || "Your listing"}</h2>
          <div className="inset stack" style={{ gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="truck" size={18} />
              {resourceFor(selected)?.vehicle_type || "Listing"}
              {resourceFor(selected)?.hourly_rate ? ` · ${formatInr(resourceFor(selected).hourly_rate)}/hr` : ""}
            </span>
            <span className="muted mono" style={{ fontSize: 12 }}>Job {selected.job_id ? selected.job_id.slice(0, 8) : "not linked"}</span>
          </div>
          {selected.message
            ? <p style={{ fontSize: 16, lineHeight: 1.45 }}>“{selected.message}”</p>
            : <p className="muted">No note from the contractor.</p>}
          {action.error && <Alert>{action.error}</Alert>}
          {selected.status === "pending" ? (
            <div className="row" style={{ gap: 10 }}>
              <Button variant="ghost-dark" icon="x" onClick={() => respond(selected, false)} disabled={action.busy}>Decline</Button>
              <Button variant="saffron" icon="check" onClick={() => respond(selected, true)} disabled={action.busy}>
                {action.busy ? "Working…" : "Accept"}
              </Button>
            </div>
          ) : (
            <Badge tone={bookingTone(selected.status)}>{BOOKING_STATUS_LABELS[selected.status]}</Badge>
          )}
        </Card>
      )}
    </div>
  );
}

export function OwnerRequests() {
  const { resources, bookings } = useOwnerData();
  const [toast, setToast] = useToast();
  return (
    <main className="page">
      <PageHeader title="Booking requests" subtitle="Accepting a request reserves that rig - only one open request per listing at a time." />
      <div className="split">
        <RequestsPanel bookings={bookings} resources={resources} onToast={setToast} showAll />
        <Card className="stack">
          <CardHead title="How this works" />
          <ol className="stack" style={{ gap: 10, margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: 14 }}>
            <li>A contractor searching near a job site finds your available listing.</li>
            <li>They send a request. Your listing stays available until you accept.</li>
            <li>Accepting reserves it; declining frees it for other contractors straight away.</li>
          </ol>
          <Alert tone="info">Payment between you and the contractor still happens outside the app.</Alert>
        </Card>
      </div>
      <Toast message={toast} />
    </main>
  );
}

const BLANK_RESOURCE = {
  resource_type: "rig", name: "", vehicle_type: "", hourly_rate: "", notes: "", status: "available",
};

export function OwnerFleet() {
  const { session } = useSession();
  const { resources } = useOwnerData();
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useToast();

  const list = resources.data || [];

  return (
    <main className="page">
      <PageHeader
        title="My fleet"
        subtitle="Only listings that are available and have a location show up in a contractor's search."
        actions={<Button icon="plus" onClick={() => setEditing({ ...BLANK_RESOURCE })}>List equipment</Button>}
      />

      {resources.error && <Alert onRetry={resources.reload}>{resources.error.message}</Alert>}
      {resources.loading && !resources.data && <Card><Loading label="Loading your fleet…" /></Card>}

      {resources.data && list.length === 0 && (
        <Card>
          <EmptyState icon="truck" title="Nothing listed yet"
            action={<Button icon="plus" onClick={() => setEditing({ ...BLANK_RESOURCE })}>List your first rig</Button>}>
            Add a rig, a piece of equipment or a crew. Set its location so contractors nearby can find it.
          </EmptyState>
        </Card>
      )}

      <div className="fleet-grid">
        {list.map((r) => (
          <Card key={r.resource_id} className="stack">
            <div className="card-head" style={{ margin: 0 }}>
              <span className="tile-icon"><Icon name="truck" size={22} /></span>
              <div className="end"><Badge tone={resourceStatusTone(r.status)}>{RESOURCE_STATUS_LABELS[r.status]}</Badge></div>
            </div>
            <div className="stack" style={{ gap: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{r.name}</span>
              <span className="muted" style={{ fontSize: 14 }}>
                {RESOURCE_TYPES.find((t) => t.value === r.resource_type)?.label}
                {r.vehicle_type ? ` · ${r.vehicle_type}` : ""}
              </span>
            </div>
            {r.notes && <p className="muted clamp-2" style={{ fontSize: 14 }}>{r.notes}</p>}
            <hr className="divider" />
            <div className="card-head" style={{ margin: 0 }}>
              <span>
                <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{r.hourly_rate ? formatInr(r.hourly_rate) : "—"}</span>
                <span className="muted" style={{ fontSize: 13 }}> /hr</span>
              </span>
              <div className="end"><Button variant="light" size="sm" icon="edit" onClick={() => setEditing(r)}>Edit</Button></div>
            </div>
            <span className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="pin" size={15} />
              {r.lat === null || r.lat === undefined
                ? <span style={{ color: "var(--red)" }}>No location - not searchable</span>
                : formatCoords(r.lat, r.lng)}
            </span>
          </Card>
        ))}
      </div>

      {editing && (
        <ResourceDialog
          resource={editing}
          token={session.token}
          onClose={() => setEditing(null)}
          onSaved={async (label) => { setEditing(null); setToast(label); await resources.reload(); }}
        />
      )}
      <Toast message={toast} />
    </main>
  );
}

function ResourceDialog({ resource, token, onClose, onSaved }) {
  const isNew = !resource.resource_id;
  const action = useAction();
  const [form, setForm] = useState({
    resource_type: resource.resource_type || "rig",
    name: resource.name || "",
    vehicle_type: resource.vehicle_type || "",
    hourly_rate: resource.hourly_rate ? String(resource.hourly_rate) : "",
    notes: resource.notes || "",
    status: resource.status || "available",
  });
  const [point, setPoint] = useState(
    resource.lat !== null && resource.lat !== undefined ? { lat: resource.lat, lng: resource.lng } : PILOT_CENTER
  );

  async function save() {
    await action.run(async () => {
      const payload = {
        resource_type: form.resource_type,
        name: form.name,
        notes: form.notes || undefined,
        lat: point.lat,
        lng: point.lng,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : undefined,
        vehicle_type: form.vehicle_type || undefined,
      };
      if (isNew) {
        await createResource(RESOURCE_NETWORK_URL, token, payload);
        await onSaved("Listing added");
      } else {
        await updateResource(RESOURCE_NETWORK_URL, token, resource.resource_id, { ...payload, status: form.status });
        await onSaved("Listing updated");
      }
    });
  }

  return (
    <Dialog
      title={isNew ? "List equipment" : "Edit listing"}
      onClose={onClose}
      wide
      actions={
        <>
          <Button variant="light" onClick={onClose} disabled={action.busy}>Cancel</Button>
          <Button onClick={save} disabled={action.busy || !form.name}>
            {action.busy ? "Saving…" : isNew ? "Add listing" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Type" id="res-type">
          <Select id="res-type" value={form.resource_type} options={RESOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(e) => setForm({ ...form, resource_type: e.target.value })} />
        </Field>
        <Field label="Name" id="res-name" hint="What a contractor will see">
          <TextInput id="res-name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tata 1613 DTH rig" />
        </Field>
        <Field label="Vehicle / description" id="res-vehicle">
          <TextInput id="res-vehicle" value={form.vehicle_type}
            onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="e.g. Truck-mounted DTH 6.5”" />
        </Field>
        <Field label="Hourly rate (₹)" id="res-rate" hint="Optional - can be set later">
          <TextInput id="res-rate" type="number" min="1" step="1" value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} placeholder="2800" />
        </Field>
        {!isNew && (
          <Field label="Status" id="res-status" hint="Only 'available' is searchable">
            <Select id="res-status" value={form.status}
              options={Object.entries(RESOURCE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(e) => setForm({ ...form, status: e.target.value })} />
          </Field>
        )}
        <Field label="Notes" id="res-notes">
          <TextInput id="res-notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Crew of 4 included" />
        </Field>
      </div>

      <Field label="Where is it based?" id="res-map" hint="Click the map to set the location contractors search against">
        <div className="map-frame" style={{ borderRadius: 16 }}>
          <SiteMap marker={point} draggableMarker onMove={setPoint} center={point} zoom={11} height={240} />
        </div>
      </Field>
      <KeyValue k="Location" v={<span className="mono" style={{ fontSize: 13 }}>{formatCoords(point.lat, point.lng)}</span>} />

      {action.error && <Alert>{action.error}</Alert>}
    </Dialog>
  );
}
