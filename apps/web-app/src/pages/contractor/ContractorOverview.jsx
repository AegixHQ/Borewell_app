import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PLATFORM_SPINE_URL, QUOTATION_URL, RESOURCE_NETWORK_URL,
  listMyJobs, getLatestQuotationForJob, listBookings,
  PHASES, STAGE_LABELS, formatInr, formatRelative, jobTypeLabel, phaseOf, shortId, stageTone,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon, { JobTypeIcon } from "../../components/Icon.jsx";
import DepthGauge from "../../components/DepthGauge.jsx";
import { Alert, Badge, Button, Card, EmptyState, Loading, Pills } from "../../components/ui.jsx";
import { useAreaName, useLoad } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

export default function ContractorOverview() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const jobs = useLoad(() => listMyJobs(PLATFORM_SPINE_URL, session.token), [session.token], { pollMs: 30000 });
  const bookings = useLoad(() => listBookings(RESOURCE_NETWORK_URL, session.token), [session.token], { pollMs: 30000 });

  // Quotes for the jobs currently sitting in the "Quoted" phase - that is
  // what the money figures on this screen are about, so only those get
  // fetched rather than one call per job.
  const quotedJobs = useMemo(
    () => (jobs.data || []).filter((j) => phaseOf(j.status).key === "quoted"),
    [jobs.data]
  );
  const quotedIds = quotedJobs.map((j) => j.job_id).join(",");
  const quotes = useLoad(async () => {
    const results = await Promise.all(
      quotedJobs.map((j) =>
        getLatestQuotationForJob(QUOTATION_URL, session.token, j.job_id)
          .then((q) => [j.job_id, q])
          .catch(() => [j.job_id, null])
      )
    );
    return Object.fromEntries(results);
  }, [quotedIds]);

  const list = useMemo(() => jobs.data || [], [jobs.data]);
  const counts = useMemo(() => {
    const byPhase = Object.fromEntries(PHASES.map((p) => [p.key, 0]));
    list.forEach((j) => { byPhase[phaseOf(j.status).key] += 1; });
    return byPhase;
  }, [list]);

  const awaiting = Object.values(quotes.data || {}).reduce(
    (sum, q) => (q && q.status !== "approved" && q.status !== "rejected" ? sum + Number(q.total_estimate || 0) : sum),
    0
  );
  const drilling = list.filter((j) => phaseOf(j.status).key === "drilling").length;
  const pendingBookings = (bookings.data || []).filter((b) => b.status === "pending").length;

  const filtered = phase === "all" ? list : list.filter((j) => phaseOf(j.status).key === phase);
  const selected = filtered.find((j) => j.job_id === selectedId) || filtered[0] || null;

  return (
    <main className="page">
      <PageHeader
        title={greeting(session.email)}
        subtitle={`${list.length} jobs on your board · ${pendingBookings} rig ${pendingBookings === 1 ? "request" : "requests"} awaiting an owner`}
        actions={<Button icon="search" variant="light" onClick={() => navigate("/contractor/rigs")}>Find rigs</Button>}
      />

      {jobs.error && <Alert onRetry={jobs.reload}>{jobs.error.message}</Alert>}

      <div className="kpis">
        <Kpi hero label="Awaiting customer approval" value={formatInr(awaiting.toFixed(2))}
          sub={`${quotedJobs.length} ${quotedJobs.length === 1 ? "quote" : "quotes"}`} icon="arrowRight" />
        <Kpi label="New leads" value={counts.leads ?? 0} sub="to estimate" icon="inbox" />
        <Kpi label="Rigs on site" value={drilling} sub="jobs drilling now" icon="truck" />
        <Kpi label="Closing" value={counts.closing ?? 0} sub="completion & payment" icon="layers" />
      </div>

      <div className="split">
        <Card className="stack">
          <Pills
            value={phase}
            onChange={(v) => { setPhase(v); setSelectedId(null); }}
            options={[
              { value: "all", label: "All", count: list.length },
              ...PHASES.map((p) => ({ value: p.key, label: p.label, count: counts[p.key] })),
            ]}
          />

          {jobs.loading && !jobs.data && <Loading label="Loading jobs…" />}

          {jobs.data && filtered.length === 0 && (
            <EmptyState icon="inbox" title="Nothing here yet">
              {phase === "all"
                ? "When a customer submits a request it lands here as a new lead."
                : "No jobs in this phase right now."}
            </EmptyState>
          )}

          {filtered.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Job</th><th>Type</th><th>Village</th><th>Stage</th>
                    <th className="right">Value</th><th className="right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => (
                    <JobRow
                      key={job.job_id}
                      job={job}
                      quote={quotes.data?.[job.job_id]}
                      selected={selected?.job_id === job.job_id}
                      onSelect={() => setSelectedId(job.job_id)}
                      onOpen={() => navigate(`/contractor/jobs/${job.job_id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selected ? (
          <JobPreview job={selected} quote={quotes.data?.[selected.job_id]} />
        ) : (
          <Card><EmptyState icon="briefcase" title="Select a job">Pick a row to see its quote and next step.</EmptyState></Card>
        )}
      </div>
    </main>
  );
}

function Kpi({ label, value, sub, icon, hero }) {
  return (
    <div className={`kpi ${hero ? "hero" : ""}`}>
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon"><Icon name={icon} size={18} strokeWidth={hero ? 2.2 : 1.75} /></span>
      </div>
      <div className="kpi-val">
        <b>{value}</b>
        <span className="kpi-sub">{sub}</span>
      </div>
    </div>
  );
}

function JobRow({ job, quote, selected, onSelect, onOpen }) {
  const area = useAreaName(job.location?.lat, job.location?.lng);
  return (
    <tr
      className={selected ? "selected" : ""}
      onClick={onSelect}
      onDoubleClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
    >
      <td><span className="mono muted" style={{ fontSize: 13 }}>{shortId(job.job_id)}</span></td>
      <td style={{ fontWeight: 600 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <JobTypeIcon jobType={job.job_type} size={16} />{jobTypeLabel(job.job_type, true)}
        </span>
      </td>
      <td className="ink2">{area ? area.name : "—"}</td>
      <td><Badge tone={stageTone(job.status)}>{STAGE_LABELS[job.status]}</Badge></td>
      <td className="right num" style={{ fontWeight: 600 }}>{quote ? formatInr(quote.total_estimate) : "—"}</td>
      <td className="right muted">{formatRelative(job.created_at)}</td>
    </tr>
  );
}

function JobPreview({ job, quote }) {
  const navigate = useNavigate();
  const area = useAreaName(job.location?.lat, job.location?.lng);
  return (
    <Card tone="dark" className="stack">
      <div className="card-head" style={{ margin: 0 }}>
        <span className="mono" style={{ fontSize: 13, color: "var(--on-chrome-muted)" }}>{shortId(job.job_id)}</span>
        <div className="end"><Badge tone={stageTone(job.status)}>{STAGE_LABELS[job.status]}</Badge></div>
      </div>
      <div className="stack" style={{ gap: 2 }}>
        <h2 className="title-lg">{area ? area.name : jobTypeLabel(job.job_type, true)}</h2>
        <span className="muted">{jobTypeLabel(job.job_type, true)}{area ? ` · ${area.district}` : ""}</span>
      </div>

      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        {quote && (
          <DepthGauge
            min={quote.estimated_depth_range.min_ft}
            max={quote.estimated_depth_range.max_ft}
            water={area?.estimated_water_depth_ft}
            height={200}
            width={104}
            dark
          />
        )}
        <div className="stack" style={{ gap: 16 }}>
          <div className="kv">
            <span className="k">{quote ? `Quote v${quote.version}` : "Quote"}</span>
            <span className="num" style={{ fontSize: 30, fontWeight: 700 }}>
              {quote ? formatInr(quote.total_estimate) : "Not sent yet"}
            </span>
          </div>
          {quote && (
            <div className="kv">
              <span className="k">Expected depth</span>
              <span className="num" style={{ fontSize: 20, fontWeight: 600, color: "var(--saffron)" }}>
                {quote.estimated_depth_range.min_ft}–{quote.estimated_depth_range.max_ft} ft
              </span>
              <span className="k">{quote.estimated_depth_range.confidence} confidence</span>
            </div>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 10, marginTop: "auto" }}>
        <Button variant="saffron" block trailing="arrowRight" onClick={() => navigate(`/contractor/jobs/${job.job_id}`)}>
          Open job
        </Button>
        <Button variant="ghost-dark" block icon="search" onClick={() => navigate(`/contractor/rigs/${job.job_id}`)}>
          Find rigs near this site
        </Button>
      </div>
    </Card>
  );
}

function greeting(email) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = (email || "").split("@")[0].replace(/[._-]+/g, " ");
  return `${part}, ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}
