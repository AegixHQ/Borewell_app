import { Link, useNavigate } from "react-router-dom";
import {
  PLATFORM_SPINE_URL, listMyJobs, formatRelative, jobTypeLabel, shortId,
  stageTone, STAGE_LABELS, customerStepIndex,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import { JobTypeIcon } from "../../components/Icon.jsx";
import { Alert, Badge, Button, Card, EmptyState, Loading } from "../../components/ui.jsx";
import { CustomerSteps } from "../../components/StageViews.jsx";
import { useAreaName, useLoad } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

export default function CustomerHome() {
  const { session } = useSession();
  const navigate = useNavigate();
  const jobs = useLoad(() => listMyJobs(PLATFORM_SPINE_URL, session.token), [session.token], { pollMs: 30000 });

  const active = (jobs.data || []).filter((j) => j.status !== "service_history");
  const past = (jobs.data || []).filter((j) => j.status === "service_history");

  return (
    <main className="page">
      <PageHeader
        title="Your borewells"
        subtitle="Track a request, review your quote and pay - all in one place."
        actions={<Button trailing="arrowRight" onClick={() => navigate("/customer/new")}>Request a borewell</Button>}
      />

      {jobs.error && <Alert onRetry={jobs.reload}>{jobs.error.message}</Alert>}
      {jobs.loading && !jobs.data && <Card><Loading label="Loading your jobs…" /></Card>}

      {jobs.data && jobs.data.length === 0 && (
        <Card>
          <EmptyState
            icon="drop"
            title="No borewell requests yet"
            action={<Button trailing="arrowRight" onClick={() => navigate("/customer/new")}>Request a borewell</Button>}
          >
            Pin your site on the map and a contractor will send you a quote with the expected depth range.
          </EmptyState>
        </Card>
      )}

      {active.length > 0 && (
        <div className="job-cards">
          {active.map((job) => <JobCard key={job.job_id} job={job} />)}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="title-md" style={{ marginTop: 12 }}>Completed</h2>
          <div className="job-cards">
            {past.map((job) => <JobCard key={job.job_id} job={job} />)}
          </div>
        </>
      )}
    </main>
  );
}

function JobCard({ job }) {
  const area = useAreaName(job.location?.lat, job.location?.lng);
  const step = customerStepIndex(job.status);
  return (
    <Link to={`/customer/jobs/${job.job_id}`} style={{ display: "block" }}>
      <Card className="stack">
        <div className="card-head" style={{ margin: 0 }}>
          <span className="tile-icon"><JobTypeIcon jobType={job.job_type} /></span>
          <div className="stack" style={{ gap: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{jobTypeLabel(job.job_type, true)} borewell</span>
            <span className="muted" style={{ fontSize: 14 }}>{area ? `${area.name}, ${area.district}` : "Location pinned"}</span>
          </div>
          <div className="end"><Badge tone={stageTone(job.status)}>{STAGE_LABELS[job.status]}</Badge></div>
        </div>

        <CustomerSteps status={job.status} />

        {step === 1 && (
          <div className="inset" style={{ background: "var(--saffron-soft)", color: "var(--saffron-ink)", fontWeight: 600 }}>
            Your quote is ready to review
          </div>
        )}

        <div className="card-head" style={{ margin: 0 }}>
          <span className="mono muted" style={{ fontSize: 12 }}>{shortId(job.job_id)}</span>
          <div className="end muted" style={{ fontSize: 13 }}>{formatRelative(job.created_at)}</div>
        </div>
      </Card>
    </Link>
  );
}
