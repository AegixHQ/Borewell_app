import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PLATFORM_SPINE_URL, RESOURCE_NETWORK_URL,
  getJob, listMyJobs, matchResources, createBookingRequest, listBookings,
  formatInr, jobTypeLabel, shortId, RESOURCE_TYPES, BOOKING_STATUS_LABELS, bookingTone,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon, { JobTypeIcon } from "../../components/Icon.jsx";
import SiteMap from "../../components/SiteMap.jsx";
import {
  Alert, Badge, Button, Card, EmptyState, Field, Loading, Pills, TextInput, Toast,
} from "../../components/ui.jsx";
import { useAction, useAreaName, useLoad, useToast } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

function distanceLabel(km) {
  if (km === null || km === undefined) return "distance unknown";
  return km < 1 ? "under 1 km away" : `${Number(km).toFixed(1)} km away`;
}

export default function FindRigs() {
  const { jobId } = useParams();
  return jobId ? <RigSearch jobId={jobId} /> : <JobPicker />;
}

function JobPicker() {
  const { session } = useSession();
  const navigate = useNavigate();
  const jobs = useLoad(() => listMyJobs(PLATFORM_SPINE_URL, session.token), [session.token]);

  return (
    <main className="page">
      <PageHeader title="Find rigs" subtitle="Pick the job you're sourcing a rig for - the search runs around its site." />
      {jobs.error && <Alert onRetry={jobs.reload}>{jobs.error.message}</Alert>}
      {jobs.loading && !jobs.data && <Card><Loading label="Loading jobs…" /></Card>}
      {jobs.data && jobs.data.length === 0 && (
        <Card><EmptyState icon="inbox" title="No jobs yet">A customer request has to exist before you can search for a rig near it.</EmptyState></Card>
      )}
      {jobs.data && jobs.data.length > 0 && (
        <Card className="stack">
          {jobs.data.map((job) => (
            <JobPickRow key={job.job_id} job={job} onOpen={() => navigate(`/contractor/rigs/${job.job_id}`)} />
          ))}
        </Card>
      )}
    </main>
  );
}

function JobPickRow({ job, onOpen }) {
  const area = useAreaName(job.location?.lat, job.location?.lng);
  return (
    <button type="button" className="list-row" onClick={onOpen}>
      <span className="tile-icon"><JobTypeIcon jobType={job.job_type} /></span>
      <span className="stack" style={{ gap: 0 }}>
        <span style={{ fontWeight: 700 }}>{area ? area.name : "Site"} · {jobTypeLabel(job.job_type, true)}</span>
        <span className="muted mono" style={{ fontSize: 12 }}>{shortId(job.job_id)}</span>
      </span>
      <span className="end" style={{ marginLeft: "auto" }}><Icon name="chevronRight" size={18} /></span>
    </button>
  );
}

function RigSearch({ jobId }) {
  const { session } = useSession();
  const [toast, setToast] = useToast();
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const action = useAction();

  const job = useLoad(() => getJob(PLATFORM_SPINE_URL, session.token, jobId), [jobId]);
  const area = useAreaName(job.data?.location?.lat, job.data?.location?.lng);
  const bookings = useLoad(() => listBookings(RESOURCE_NETWORK_URL, session.token), [jobId]);

  const results = useLoad(async () => {
    if (!job.data) return null;
    return matchResources(RESOURCE_NETWORK_URL, session.token, {
      lat: job.data.location.lat,
      lng: job.data.location.lng,
      resourceType: type === "all" ? undefined : type,
      maxResults: 10,
    });
  }, [job.data?.job_id, type]);

  useEffect(() => { setSelected(null); }, [type]);

  const jobBookings = (bookings.data || []).filter((b) => b.job_id === jobId);
  function bookingFor(resourceId) {
    return jobBookings.find((b) => b.resource_id === resourceId);
  }

  async function sendRequest() {
    await action.run(
      async () => {
        await createBookingRequest(RESOURCE_NETWORK_URL, session.token, {
          resourceId: selected.resource_id,
          jobId,
          message: note || undefined,
        });
        setNote("");
        setToast("Booking request sent to the owner");
        await Promise.all([bookings.reload(), results.reload({ quiet: true })]);
      },
      {
        onError: (err) => {
          if (err.code === "RESOURCE_ALREADY_REQUESTED") return "Another contractor already has an open request on this rig. Try the next one.";
          if (err.code === "RESOURCE_NOT_AVAILABLE") return "This rig is no longer available - refresh the search.";
          return err.message;
        },
      }
    );
  }

  if (job.loading && !job.data) return <main className="page"><Card><Loading label="Loading site…" /></Card></main>;
  if (job.error) return <main className="page"><Alert onRetry={job.reload}>{job.error.message}</Alert></main>;

  return (
    <main className="page">
      <PageHeader
        back={{ to: `/contractor/jobs/${jobId}`, label: "Back to job" }}
        eyebrow={`${shortId(jobId)} · ${jobTypeLabel(job.data.job_type, true).toUpperCase()}`}
        title={area ? `Rigs near ${area.name}` : "Rigs near this site"}
        subtitle="Every owner's available listings, nearest first."
        actions={<Button variant="light" icon="refresh" onClick={() => results.reload()}>Refresh</Button>}
      />

      <div className="split">
        <Card className="stack">
          <Pills
            value={type}
            onChange={setType}
            options={[{ value: "all", label: "All" }, ...RESOURCE_TYPES.map((r) => ({ value: r.value, label: r.label }))]}
          />

          {results.loading && <Loading label="Searching the marketplace…" />}
          {results.error && <Alert onRetry={results.reload}>{results.error.message}</Alert>}

          {results.data && results.data.length === 0 && (
            <EmptyState icon="truck" title="No rigs match this search">
              Only available listings with a location set are searchable. Try removing the type filter, or check back later.
            </EmptyState>
          )}

          {(results.data || []).map((res, i) => {
            const booking = bookingFor(res.resource_id);
            const active = selected?.resource_id === res.resource_id;
            return (
              <button
                key={res.resource_id}
                type="button"
                className={`list-row ${active ? "active" : ""}`}
                onClick={() => setSelected(res)}
              >
                <span className="num-dot">{i + 1}</span>
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{res.name}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {res.vehicle_type || RESOURCE_TYPES.find((t) => t.value === res.resource_type)?.label} · {distanceLabel(res.distance_km)}
                  </span>
                </span>
                <span className="end stack" style={{ marginLeft: "auto", alignItems: "flex-end", gap: 2 }}>
                  <span className="num" style={{ fontWeight: 700 }}>{res.hourly_rate ? `${formatInr(res.hourly_rate)}/hr` : "Rate on ask"}</span>
                  {booking && <Badge tone={bookingTone(booking.status)}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>}
                </span>
              </button>
            );
          })}

          <p className="hint">
            Distance is straight-line from the job site. One open request per rig at a time - the owner accepts or declines.
          </p>
        </Card>

        <div className="stack">
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <SiteMap
              marker={job.data.location}
              center={job.data.location}
              circle={{ ...job.data.location, radiusKm: 10 }}
              zoom={11}
              height={260}
            />
            <div className="stack" style={{ gap: 2, padding: 16 }}>
              <span style={{ fontWeight: 600 }}>{area ? `${area.name}, ${area.district}` : "Job site"}</span>
              <span className="muted" style={{ fontSize: 13 }}>Dashed ring is 10 km from the site.</span>
            </div>
          </Card>

          {selected ? (
            <Card tone="dark" className="stack">
              <div className="stack" style={{ gap: 2 }}>
                <h2 className="title-md">{selected.name}</h2>
                <span className="muted">{selected.vehicle_type || selected.resource_type} · {distanceLabel(selected.distance_km)}</span>
              </div>
              <div className="row" style={{ gap: 24 }}>
                <div className="kv">
                  <span className="k">Rate</span>
                  <span className="num" style={{ fontSize: 22, fontWeight: 700, color: "var(--saffron)" }}>
                    {selected.hourly_rate ? `${formatInr(selected.hourly_rate)}/hr` : "On ask"}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Status</span>
                  <span className="v">{selected.status}</span>
                </div>
              </div>
              {bookingFor(selected.resource_id) ? (
                <Alert tone="info">
                  You already have a {BOOKING_STATUS_LABELS[bookingFor(selected.resource_id).status].toLowerCase()} request on this rig.
                </Alert>
              ) : (
                <>
                  <Field label="Note for the owner" id="booking-note">
                    <TextInput
                      id="booking-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Need the rig on site by Monday, 2 days work"
                    />
                  </Field>
                  {action.error && <Alert>{action.error}</Alert>}
                  <Button variant="saffron" block trailing="arrowRight" onClick={sendRequest} disabled={action.busy}>
                    {action.busy ? "Sending…" : "Send booking request"}
                  </Button>
                </>
              )}
            </Card>
          ) : (
            <Card><EmptyState icon="truck" title="Pick a rig">Select a listing to see its details and send a booking request.</EmptyState></Card>
          )}
        </div>
      </div>
      <Toast message={toast} />
    </main>
  );
}
