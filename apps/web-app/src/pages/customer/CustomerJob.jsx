import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  PLATFORM_SPINE_URL, QUOTATION_URL, PAYMENTS_URL,
  getJob, getLatestQuotationForJob, approveQuotation, rejectQuotation,
  listPayments, createPayment, createRazorpayOrder, getJobCompletionResult,
  formatInr, formatCoords, jobTypeLabel, shortId, STAGE_LABELS, stageTone, customerStepIndex,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon from "../../components/Icon.jsx";
import DepthGauge from "../../components/DepthGauge.jsx";
import SiteMap from "../../components/SiteMap.jsx";
import { CustomerSteps } from "../../components/StageViews.jsx";
import {
  Alert, Badge, Button, Card, CardHead, ConfirmDialog, KeyValue, Loading, Toast,
} from "../../components/ui.jsx";
import { useAction, useAreaName, useLoad, useToast } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";
import { openCheckout } from "../../lib/razorpay.js";

export default function CustomerJob() {
  const { jobId } = useParams();
  const { session } = useSession();
  const [toast, setToast] = useToast();
  const [confirm, setConfirm] = useState(null);
  const action = useAction();

  const job = useLoad(() => getJob(PLATFORM_SPINE_URL, session.token, jobId), [jobId], { pollMs: 20000 });
  const quote = useLoad(
    () => getLatestQuotationForJob(QUOTATION_URL, session.token, jobId).catch((err) => {
      // 404 until the contractor generates one - an expected state, not an error.
      if (err.code === "QUOTATION_NOT_FOUND" || err.status === 404) return null;
      throw err;
    }),
    [jobId],
    { pollMs: 15000 }
  );
  const payments = useLoad(() => listPayments(PAYMENTS_URL, session.token), [jobId], { pollMs: 15000 });
  const completion = useLoad(
    () => getJobCompletionResult(PLATFORM_SPINE_URL, session.token, jobId).catch((err) => {
      if (err.status === 404) return null;
      throw err;
    }),
    [jobId]
  );

  const area = useAreaName(job.data?.location?.lat, job.data?.location?.lng);
  const payment = (payments.data || []).find((p) => p.job_id === jobId) || null;
  const q = quote.data;

  async function handleApprove() {
    await action.run(async () => {
      await approveQuotation(QUOTATION_URL, session.token, q.quotation_id);
      setConfirm(null);
      setToast("Quotation approved");
      await Promise.all([quote.reload(), job.reload()]);
    });
  }

  async function handleReject() {
    await action.run(async () => {
      await rejectQuotation(QUOTATION_URL, session.token, q.quotation_id);
      setConfirm(null);
      setToast("Change request sent to your contractor");
      await quote.reload();
    });
  }

  async function handlePay() {
    await action.run(async () => {
      const existing = payment && payment.status === "pending"
        ? payment
        : await createPayment(PAYMENTS_URL, session.token, {
            jobId,
            quotationId: q.quotation_id,
            // decimal string, passed through untouched so the backend's
            // exact-amount check has something exact to compare
            amount: q.total_estimate,
            idempotencyKey: `job-${jobId}-quote-${q.quotation_id}`,
          });
      const order = await createRazorpayOrder(PAYMENTS_URL, session.token, existing.payment_id);
      const result = await openCheckout({
        order,
        email: session.email,
        description: `${jobTypeLabel(job.data.job_type, true)} borewell · ${shortId(jobId)}`,
      });
      await payments.reload();
      if (result.attempted) setToast("Payment submitted - confirming with the bank");
    }, {
      onError: (err) => (err.status === 502
        ? "Online payment isn't switched on for this server yet (Razorpay keys are missing). Your contractor can still take payment directly."
        : err.message),
    });
  }

  if (job.loading && !job.data) return <main className="page"><Card><Loading label="Loading your job…" /></Card></main>;
  if (job.error) return <main className="page"><Alert onRetry={job.reload}>{job.error.message}</Alert></main>;

  const step = customerStepIndex(job.data.status);
  const approved = q?.status === "approved";
  const rejected = q?.status === "rejected";

  return (
    <main className="page">
      <PageHeader
        back={{ to: "/customer", label: "Your borewells" }}
        eyebrow={`${shortId(jobId)} · ${jobTypeLabel(job.data.job_type, true)}`}
        title={area ? `${area.name} borewell` : "Your borewell"}
        subtitle={area ? `${area.name}, ${area.district}` : formatCoords(job.data.location.lat, job.data.location.lng)}
        actions={<Badge tone={stageTone(job.data.status)}>{STAGE_LABELS[job.data.status]}</Badge>}
      />

      <Card tone="dark" className="stack">
        <span className="eyebrow">Now</span>
        <h2 className="title-lg">{headline(job.data.status, q, payment)}</h2>
        <CustomerSteps status={job.data.status} />
      </Card>

      <div className="split">
        <div className="stack">
          {quote.error && <Alert onRetry={quote.reload}>{quote.error.message}</Alert>}
          {action.error && <Alert onRetry={() => action.setError(null)} retryLabel="Dismiss">{action.error}</Alert>}

          {!q && !quote.loading && (
            <Card>
              <div className="empty">
                <span className="empty-icon"><Icon name="clock" size={24} /></span>
                <h3>Waiting for your quote</h3>
                <p>Your contractor is preparing it. This page updates by itself - no need to refresh.</p>
              </div>
            </Card>
          )}

          {q && (
            <Card className="stack">
              <CardHead title="Your quotation">
                <span className="tag-mono">v{q.version}</span>
                <div className="end">
                  {approved && <Badge tone="green">Approved</Badge>}
                  {rejected && <Badge tone="red">Changes requested</Badge>}
                  {!approved && !rejected && <Badge tone="saffron">Awaiting your approval</Badge>}
                </div>
              </CardHead>

              <div className="inset" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                <div className="stack" style={{ gap: 6, minWidth: 190 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Expected depth</span>
                  <span className="num" style={{ fontSize: 28, fontWeight: 700 }}>
                    {q.estimated_depth_range.min_ft}–{q.estimated_depth_range.max_ft} ft
                  </span>
                  <Badge tone={confidenceTone(q.estimated_depth_range.confidence)}>
                    {capitalise(q.estimated_depth_range.confidence)} confidence
                  </Badge>
                  <p className="muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
                    Depth is only certain while drilling.
                    {q.depth_overage_rate_per_ft
                      ? ` Past ${q.estimated_depth_range.max_ft} ft, each extra foot costs ${formatInr(q.depth_overage_rate_per_ft)}.`
                      : ""}
                  </p>
                </div>
                <DepthGauge
                  min={q.estimated_depth_range.min_ft}
                  max={q.estimated_depth_range.max_ft}
                  water={area?.estimated_water_depth_ft}
                  height={230}
                  width={120}
                />
              </div>

              <div className="stack" style={{ gap: 0 }}>
                {q.line_items.map((item, i) => (
                  <div className="receipt-row" key={`${item.label}-${i}`}>
                    <span>{item.label}</span>
                    <span className="leader" />
                    <span className="amt">{formatInr(item.amount)}</span>
                  </div>
                ))}
                <div className="receipt-row">
                  <span>Service charge</span>
                  <span className="leader" />
                  <span className="amt">{formatInr(q.margin_amount)}</span>
                </div>
              </div>

              <div className="total-bar">
                <span style={{ fontSize: 16, fontWeight: 600 }}>Total estimate</span>
                <b>{formatInr(q.total_estimate)}</b>
              </div>

              {!approved && !rejected && (
                <div className="row" style={{ gap: 10 }}>
                  <Button variant="light" onClick={() => setConfirm("reject")} disabled={action.busy}>Ask for changes</Button>
                  <Button variant="saffron" trailing="arrowRight" onClick={() => setConfirm("approve")} disabled={action.busy}>
                    Approve quotation
                  </Button>
                </div>
              )}

              {rejected && (
                <Alert tone="info">
                  You asked for changes. Your contractor will send a new version - it will appear here.
                </Alert>
              )}
            </Card>
          )}

          {approved && (
            <Card className="stack">
              <CardHead title="Payment">
                <div className="end">
                  {payment ? <Badge tone={paymentTone(payment.status)}>{paymentLabel(payment.status)}</Badge> : <Badge>Not started</Badge>}
                </div>
              </CardHead>
              {payment?.status === "completed" ? (
                <div className="row" style={{ alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <KeyValue k="Paid" v={formatInr(payment.amount)} />
                  {payment.razorpay_payment_id && <KeyValue k="Reference" v={<span className="mono" style={{ fontSize: 13 }}>{payment.razorpay_payment_id}</span>} />}
                </div>
              ) : (
                <>
                  <p className="muted">
                    Pay securely with UPI, card or net banking. Your payment is confirmed by the bank, not by this screen.
                  </p>
                  <div className="row" style={{ alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <span className="num" style={{ fontSize: 30, fontWeight: 700 }}>{formatInr(q.total_estimate)}</span>
                    <Button variant="saffron" size="lg" trailing="arrowRight" onClick={handlePay} disabled={action.busy}>
                      {action.busy ? "Opening…" : payment ? "Continue payment" : "Pay now"}
                    </Button>
                  </div>
                  {payment?.status === "pending" && (
                    <Alert tone="info" onRetry={payments.reload} retryLabel="Check again">
                      Waiting for the bank to confirm this payment.
                    </Alert>
                  )}
                  {payment?.status === "failed" && <Alert>That attempt failed. You can try again.</Alert>}
                </>
              )}
            </Card>
          )}

          {completion.data && (
            <Card className="stack">
              <CardHead title="Final result" />
              <div className="row" style={{ gap: 28, flexWrap: "wrap" }}>
                <KeyValue k="Actual depth" v={`${completion.data.actual_depth_ft} ft`} />
                <KeyValue k="Quoted" v={formatInr(completion.data.quoted_total)} />
                <KeyValue k="Final cost" v={formatInr(completion.data.actual_cost)} />
                {Number(completion.data.depth_overage_charge) > 0 && (
                  <KeyValue k="Extra depth charge" v={formatInr(completion.data.depth_overage_charge)} />
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="stack">
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <SiteMap marker={job.data.location} center={job.data.location} zoom={13} interactive={false} height={180} />
            <div className="stack" style={{ gap: 2, padding: 16 }}>
              <span style={{ fontWeight: 600 }}>{area ? `${area.name}, ${area.district}` : "Site location"}</span>
              <span className="mono muted" style={{ fontSize: 12 }}>{formatCoords(job.data.location.lat, job.data.location.lng)}</span>
            </div>
          </Card>

          <Card className="stack">
            <CardHead title="What happens next" />
            <ol className="stack" style={{ gap: 10, margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: 14 }}>
              <li>Your contractor books a rig near your site.</li>
              <li>Drilling starts on the agreed day.</li>
              <li>Actual depth and final cost are recorded here when the job closes.</li>
            </ol>
            {step >= 3 && <Alert tone="info">Drilling has started. Updates appear here as your contractor logs them.</Alert>}
          </Card>
        </div>
      </div>

      {confirm === "approve" && (
        <ConfirmDialog
          title="Approve this quotation?"
          body={`You're approving ${formatInr(q.total_estimate)} for a depth of ${q.estimated_depth_range.min_ft}–${q.estimated_depth_range.max_ft} ft. You can pay straight after.`}
          confirmLabel="Approve"
          busy={action.busy}
          onConfirm={handleApprove}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === "reject" && (
        <ConfirmDialog
          title="Ask for changes?"
          body="Your contractor will be able to send a new version of this quote. Nothing is charged."
          confirmLabel="Send request"
          busy={action.busy}
          onConfirm={handleReject}
          onClose={() => setConfirm(null)}
        />
      )}
      <Toast message={toast} />
    </main>
  );
}

function headline(status, quote, payment) {
  if (status === "service_history") return "Job complete";
  if (status === "completion" || status === "payment") return "Drilling finished";
  if (status === "drilling" || status === "progress") return "Drilling in progress";
  if (payment?.status === "completed") return "Payment received";
  if (quote?.status === "approved") return "Approved - ready to pay";
  if (quote?.status === "rejected") return "Waiting for a revised quote";
  if (quote) return "Your quote is ready";
  return "Request received";
}

function capitalise(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function confidenceTone(confidence) {
  return { high: "green", medium: "saffron", low: "red" }[confidence] || "neutral";
}

function paymentTone(status) {
  return { completed: "green", pending: "saffron", failed: "red" }[status] || "neutral";
}

function paymentLabel(status) {
  return { completed: "Paid", pending: "Awaiting confirmation", failed: "Failed" }[status] || status;
}
