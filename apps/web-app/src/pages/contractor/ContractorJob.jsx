import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PLATFORM_SPINE_URL, QUOTATION_URL, RESOURCE_NETWORK_URL, PAYMENTS_URL,
  getJob, updateJobStatus, getLatestQuotationForJob, generateQuotation, editQuotation,
  listBookings, listPayments, logJobCompletion, getJobCompletionResult,
  formatCoords, formatInr, jobTypeLabel, nextStage, shortId, STAGE_LABELS, stageIndex, stageTone,
  JOB_STAGES, bookingTone, BOOKING_STATUS_LABELS,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon from "../../components/Icon.jsx";
import DepthGauge from "../../components/DepthGauge.jsx";
import SiteMap from "../../components/SiteMap.jsx";
import { StageRail } from "../../components/StageViews.jsx";
import {
  Alert, Badge, Button, Card, CardHead, ConfirmDialog, Dialog, Field, KeyValue,
  Loading, TextInput, Toast,
} from "../../components/ui.jsx";
import { useAction, useAreaName, useLoad, useToast } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

export default function ContractorJob() {
  const { jobId } = useParams();
  const { session } = useSession();
  const navigate = useNavigate();
  const [toast, setToast] = useToast();
  const [dialog, setDialog] = useState(null);
  const action = useAction();

  const job = useLoad(() => getJob(PLATFORM_SPINE_URL, session.token, jobId), [jobId], { pollMs: 30000 });
  const quote = useLoad(
    () => getLatestQuotationForJob(QUOTATION_URL, session.token, jobId).catch((err) => {
      if (err.code === "QUOTATION_NOT_FOUND" || err.status === 404) return null;
      throw err;
    }),
    [jobId],
    { pollMs: 20000 }
  );
  const bookings = useLoad(() => listBookings(RESOURCE_NETWORK_URL, session.token), [jobId], { pollMs: 30000 });
  const payments = useLoad(() => listPayments(PAYMENTS_URL, session.token), [jobId], { pollMs: 30000 });
  const completion = useLoad(
    () => getJobCompletionResult(PLATFORM_SPINE_URL, session.token, jobId).catch((err) => {
      if (err.status === 404) return null;
      throw err;
    }),
    [jobId]
  );

  const area = useAreaName(job.data?.location?.lat, job.data?.location?.lng);
  const q = quote.data;
  const jobBookings = (bookings.data || []).filter((b) => b.job_id === jobId);
  const payment = (payments.data || []).find((p) => p.job_id === jobId);

  async function handleAdvance() {
    const next = nextStage(job.data.status);
    await action.run(async () => {
      await updateJobStatus(PLATFORM_SPINE_URL, session.token, jobId, next);
      setDialog(null);
      setToast(`Moved to ${STAGE_LABELS[next]}`);
      await job.reload();
    });
  }

  async function handleGenerate() {
    await action.run(
      async () => {
        await generateQuotation(QUOTATION_URL, session.token, {
          jobId,
          lat: job.data.location.lat,
          lng: job.data.location.lng,
          jobType: job.data.job_type,
        });
        setToast("Quotation sent to the customer");
        await quote.reload();
      },
      {
        onError: (err) => (err.code === "PRICING_RULE_MISSING"
          ? `Set your pricing rule for ${jobTypeLabel(job.data.job_type, true).toLowerCase()} jobs before quoting - open Pricing.`
          : err.message),
      }
    );
  }

  if (job.loading && !job.data) return <main className="page"><Card><Loading label="Loading job…" /></Card></main>;
  if (job.error) return <main className="page"><Alert onRetry={job.reload}>{job.error.message}</Alert></main>;

  const next = nextStage(job.data.status);
  const atCompletion = job.data.status === "completion";

  return (
    <main className="page">
      <PageHeader
        back={{ to: "/contractor", label: "Overview" }}
        eyebrow={`${shortId(jobId)} · ${jobTypeLabel(job.data.job_type, true).toUpperCase()}${area ? ` · ${area.name.toUpperCase()}` : ""}`}
        title={area ? `${area.name} site` : "Job"}
        subtitle={formatCoords(job.data.location.lat, job.data.location.lng)}
        actions={
          <>
            <Badge tone={stageTone(job.data.status)}>{STAGE_LABELS[job.data.status]}</Badge>
            {q && <Button variant="light" icon="edit" onClick={() => setDialog("edit")}>Edit as v{q.version + 1}</Button>}
            {next && <Button trailing="arrowRight" onClick={() => setDialog("advance")} disabled={action.busy}>Advance stage</Button>}
          </>
        }
      />

      {action.error && <Alert onRetry={() => action.setError(null)} retryLabel="Dismiss">{action.error}</Alert>}

      <div className="three">
        <Card className="rail-col stack">
          <span className="eyebrow">Stage {stageIndex(job.data.status) + 1} of {JOB_STAGES.length}</span>
          <StageRail status={job.data.status} />
        </Card>

        <div className="stack">
          <Card className="stack">
            <CardHead title="Quotation">
              {q && <span className="tag-mono">v{q.version} · {q.status.toUpperCase()}</span>}
              <div className="end">
                {q && <Badge tone={quoteTone(q.status)}>{quoteLabel(q.status)}</Badge>}
              </div>
            </CardHead>

            {quote.loading && !quote.data && <Loading label="Checking for a quotation…" />}

            {!q && !quote.loading && (
              <div className="stack">
                <p className="muted">
                  No quotation yet. Generating one uses your pricing rules and, inside a pilot area, the local
                  water-table estimate instead of your flat assumed depth.
                </p>
                <Button trailing="arrowRight" onClick={handleGenerate} disabled={action.busy}>
                  {action.busy ? "Generating…" : "Generate quotation"}
                </Button>
              </div>
            )}

            {q && (
              <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
                <div className="stack" style={{ gap: 0, flex: "1 1 320px" }}>
                  {q.line_items.map((item, i) => (
                    <div className="receipt-row" key={`${item.label}-${i}`}>
                      <span>{item.label}</span>
                      <span className="leader" />
                      <span className="amt">{formatInr(item.amount)}</span>
                    </div>
                  ))}
                  <hr className="divider" style={{ margin: "8px 0" }} />
                  <div className="receipt-row">
                    <span className="muted">Subtotal {formatInr(q.subtotal)} + margin</span>
                    <span className="leader" />
                    <span className="amt">{formatInr(q.margin_amount)}</span>
                  </div>
                  {q.minimum_charge_applied && (
                    <Alert tone="info">Minimum job charge applied - the calculated total was below your floor.</Alert>
                  )}
                  <div className="total-bar" style={{ marginTop: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>Total estimate</span>
                    <b>{formatInr(q.total_estimate)}</b>
                  </div>
                </div>

                <div className="inset stack" style={{ width: 230, flex: "0 0 auto" }}>
                  <span style={{ fontWeight: 600 }}>Depth estimate</span>
                  <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>
                    {q.estimated_depth_range.min_ft}–{q.estimated_depth_range.max_ft} ft
                  </span>
                  <Badge tone={confidenceTone(q.estimated_depth_range.confidence)}>
                    {capitalise(q.estimated_depth_range.confidence)} confidence
                  </Badge>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <DepthGauge
                      min={q.estimated_depth_range.min_ft}
                      max={q.estimated_depth_range.max_ft}
                      water={area?.estimated_water_depth_ft}
                      height={260}
                      width={140}
                    />
                  </div>
                  <p className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
                    {area
                      ? `${area.name} water table ~${area.estimated_water_depth_ft} ft ± ${area.confidence_band_ft}.`
                      : "Outside the pilot areas - your flat assumed depth was used."}
                    {q.depth_overage_rate_per_ft ? ` Over ${q.estimated_depth_range.max_ft} ft: ${formatInr(q.depth_overage_rate_per_ft)}/ft.` : ""}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {atCompletion && !completion.data && (
            <CompletionCard
              jobId={jobId}
              quote={q}
              onDone={async () => { await completion.reload(); await job.reload(); setToast("Completion recorded"); }}
            />
          )}

          {completion.data && (
            <Card className="stack">
              <CardHead title="Completion" />
              <div className="row" style={{ gap: 28, flexWrap: "wrap" }}>
                <KeyValue k="Actual depth" v={`${completion.data.actual_depth_ft} ft`} />
                <KeyValue k="Quoted" v={formatInr(completion.data.quoted_total)} />
                <KeyValue k="Actual cost" v={formatInr(completion.data.actual_cost)} />
                <KeyValue
                  k="Variance"
                  v={
                    <span style={{ color: Number(completion.data.variance) > 0 ? "var(--red)" : "var(--green)" }}>
                      {Number(completion.data.variance) > 0 ? "+" : ""}{formatInr(completion.data.variance)}
                    </span>
                  }
                />
                {Number(completion.data.depth_overage_ft) > 0 && (
                  <KeyValue k="Depth overage" v={`${completion.data.depth_overage_ft} ft · ${formatInr(completion.data.depth_overage_charge)}`} />
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="stack">
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <SiteMap marker={job.data.location} center={job.data.location} zoom={13} interactive={false} height={170} />
            <div className="stack" style={{ gap: 2, padding: 16 }}>
              <span style={{ fontWeight: 600 }}>{area ? `${area.name}, ${area.district}` : "Outside pilot areas"}</span>
              <span className="mono muted" style={{ fontSize: 12 }}>{formatCoords(job.data.location.lat, job.data.location.lng)}</span>
            </div>
          </Card>

          <Card tone="dark" className="stack">
            <CardHead title="Rig booking">
              <div className="end">
                {jobBookings.length > 0
                  ? <Badge tone={bookingTone(jobBookings[0].status)}>{BOOKING_STATUS_LABELS[jobBookings[0].status]}</Badge>
                  : <Badge>None yet</Badge>}
              </div>
            </CardHead>
            {jobBookings.length === 0 ? (
              <>
                <p className="muted">No rig requested for this site yet.</p>
                <Button variant="saffron" block trailing="arrowRight" onClick={() => navigate(`/contractor/rigs/${jobId}`)}>
                  Find nearby rigs
                </Button>
              </>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {jobBookings.map((b) => <BookingLine key={b.booking_id} booking={b} />)}
                <Button variant="ghost-dark" block icon="search" onClick={() => navigate(`/contractor/rigs/${jobId}`)}>
                  Search again
                </Button>
              </div>
            )}
          </Card>

          <Card className="stack">
            <CardHead title="Payment">
              <div className="end">
                {payment ? <Badge tone={paymentTone(payment.status)}>{PAYMENT_LABELS[payment.status] || payment.status}</Badge> : <Badge>Not started</Badge>}
              </div>
            </CardHead>
            <p className="muted" style={{ fontSize: 14 }}>
              {payment
                ? `${formatInr(payment.amount)} · ${payment.status === "completed" ? "confirmed by Razorpay webhook" : "waiting on the customer"}`
                : "The customer pays after approving the quotation."}
            </p>
          </Card>
        </div>
      </div>

      {dialog === "advance" && (
        <ConfirmDialog
          title={`Move to ${STAGE_LABELS[next]}?`}
          body="Stages only move forward, one step at a time - this can't be undone from the app."
          confirmLabel={`Move to ${STAGE_LABELS[next]}`}
          busy={action.busy}
          onConfirm={handleAdvance}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === "edit" && q && (
        <EditQuoteDialog
          quote={q}
          onClose={() => setDialog(null)}
          onSaved={async () => { setDialog(null); setToast("New version sent"); await quote.reload(); }}
        />
      )}

      <Toast message={toast} />
    </main>
  );
}

function BookingLine({ booking }) {
  // GET /v1/resources is resource_owner-only, so a contractor can't resolve
  // another owner's rig name here - the search screen is where names come
  // from. Showing the short resource id keeps this honest rather than
  // inventing a label.
  return (
    <div className="inset" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Icon name="truck" size={20} />
      <div className="stack" style={{ gap: 0 }}>
        <span style={{ fontWeight: 600 }}>Requested rig</span>
        <span className="muted mono" style={{ fontSize: 12 }}>{booking.resource_id.slice(0, 8)}</span>
      </div>
      <div className="end" style={{ marginLeft: "auto" }}>
        <Badge tone={bookingTone(booking.status)}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
      </div>
    </div>
  );
}

function CompletionCard({ jobId, quote, onDone }) {
  const { session } = useSession();
  const action = useAction();
  const [depth, setDepth] = useState("");
  const [cost, setCost] = useState("");
  const [confirming, setConfirming] = useState(false);

  const overage = quote && Number(depth) > Number(quote.estimated_depth_range.max_ft)
    ? Number(depth) - Number(quote.estimated_depth_range.max_ft)
    : 0;

  async function submit() {
    await action.run(async () => {
      await logJobCompletion(PLATFORM_SPINE_URL, session.token, jobId, {
        actualDepthFt: Number(depth),
        actualCost: Number(cost),
      });
      setConfirming(false);
      await onDone();
    });
  }

  return (
    <Card className="stack">
      <CardHead title="Close out this job" />
      <p className="muted">
        Recorded once and never editable afterwards - variance against the approved quotation is computed at write time.
      </p>
      <div className="form-grid">
        <Field label="Actual depth drilled (ft)" id="actual-depth">
          <TextInput id="actual-depth" type="number" min="0" step="1" value={depth}
            onChange={(e) => setDepth(e.target.value)} placeholder="e.g. 468" />
        </Field>
        <Field label="Actual cost (₹)" id="actual-cost">
          <TextInput id="actual-cost" type="number" min="0" step="0.01" value={cost}
            onChange={(e) => setCost(e.target.value)} placeholder="e.g. 99500" />
        </Field>
      </div>
      {overage > 0 && quote?.depth_overage_rate_per_ft && (
        <Alert tone="info">
          {overage} ft beyond the quoted range - an overage charge at {formatInr(quote.depth_overage_rate_per_ft)}/ft is added automatically.
        </Alert>
      )}
      {action.error && <Alert>{action.error}</Alert>}
      <Button trailing="check" disabled={!depth || !cost || action.busy} onClick={() => setConfirming(true)}>
        Mark complete
      </Button>
      {confirming && (
        <ConfirmDialog
          title="Mark this job complete?"
          body={`Recording ${depth} ft and ${formatInr(cost)}. This is written once and can't be changed later.`}
          confirmLabel="Mark complete"
          busy={action.busy}
          onConfirm={submit}
          onClose={() => setConfirming(false)}
        />
      )}
    </Card>
  );
}

function EditQuoteDialog({ quote, onClose, onSaved }) {
  const { session } = useSession();
  const action = useAction();
  const [items, setItems] = useState(quote.line_items.map((i) => ({ ...i, amount: String(i.amount) })));

  const subtotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const total = subtotal + Number(quote.margin_amount || 0);

  function setAmount(index, value) {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, amount: value } : item)));
  }

  async function save() {
    await action.run(async () => {
      await editQuotation(QUOTATION_URL, session.token, quote.quotation_id, {
        lineItems: items.map((i) => ({ label: i.label, amount: Number(i.amount) })),
        totalEstimate: Number(total.toFixed(2)),
      });
      await onSaved();
    });
  }

  return (
    <Dialog
      title={`Edit quotation (creates v${quote.version + 1})`}
      onClose={onClose}
      wide
      actions={
        <>
          <Button variant="light" onClick={onClose} disabled={action.busy}>Cancel</Button>
          <Button onClick={save} disabled={action.busy}>{action.busy ? "Sending…" : `Send v${quote.version + 1}`}</Button>
        </>
      }
    >
      <p className="muted">
        The original version is never changed - the customer sees this as a new version of the same quote.
      </p>
      <div className="stack" style={{ gap: 10 }}>
        {items.map((item, i) => (
          <div key={`${item.label}-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, alignItems: "center" }}>
            <span>{item.label}</span>
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={item.amount}
              aria-label={`${item.label} amount`}
              onChange={(e) => setAmount(i, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="inset" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="muted">Subtotal {formatInr(subtotal.toFixed(2))} + margin {formatInr(quote.margin_amount)}</span>
        <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>{formatInr(total.toFixed(2))}</span>
      </div>
      {action.error && <Alert>{action.error}</Alert>}
    </Dialog>
  );
}

function quoteTone(status) {
  return { approved: "green", rejected: "red", draft: "saffron", sent: "saffron" }[status] || "neutral";
}

function quoteLabel(status) {
  return { approved: "Approved", rejected: "Changes requested", draft: "Awaiting approval", sent: "Awaiting approval" }[status] || status;
}

function confidenceTone(confidence) {
  return { high: "green", medium: "saffron", low: "red" }[confidence] || "neutral";
}

function paymentTone(status) {
  return { completed: "green", pending: "saffron", failed: "red" }[status] || "neutral";
}

const PAYMENT_LABELS = { completed: "Paid", pending: "Awaiting payment", failed: "Failed" };

function capitalise(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
