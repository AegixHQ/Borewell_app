import { useEffect, useState } from "react";
import { QUOTATION_URL, listPricingRules, upsertPricingRule, JOB_TYPES, formatInr } from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import { Alert, Badge, Button, Card, CardHead, Field, Loading, Segmented, TextInput, Toast } from "../../components/ui.jsx";
import { useAction, useLoad, useToast } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

const FIELDS = [
  { key: "base_rate_per_ft", label: "Drilling rate", unit: "₹ / ft", group: "Per foot" },
  { key: "casing_rate_per_ft", label: "Casing rate", unit: "₹ / ft", group: "Per foot" },
  { key: "labour_flat_fee", label: "Labour", unit: "₹", group: "Flat fees" },
  { key: "transport_flat_fee", label: "Transport", unit: "₹", group: "Flat fees" },
  { key: "equipment_flat_fee", label: "Equipment", unit: "₹", group: "Flat fees" },
  { key: "installation_flat_fee", label: "Installation", unit: "₹", group: "Flat fees" },
  { key: "margin_percent", label: "Margin", unit: "%", group: "Margin & floor" },
  { key: "minimum_job_charge", label: "Minimum job charge", unit: "₹", group: "Margin & floor" },
  { key: "assumed_depth_ft", label: "Assumed depth", unit: "ft", group: "Depth", hint: "Used outside the pilot areas" },
  { key: "depth_confidence_band_ft", label: "Confidence band", unit: "± ft", group: "Depth" },
  { key: "depth_overage_rate_per_ft", label: "Overage rate", unit: "₹ / ft", group: "Depth", hint: "Charged past the quoted maximum" },
];

const GROUPS = ["Per foot", "Flat fees", "Margin & floor", "Depth"];
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f.key, ""]));

export default function PricingRules() {
  const { session } = useSession();
  const [jobType, setJobType] = useState("agricultural");
  const [values, setValues] = useState(EMPTY);
  const [toast, setToast] = useToast();
  const action = useAction();

  const rules = useLoad(() => listPricingRules(QUOTATION_URL, session.token), [session.token]);

  useEffect(() => {
    const existing = (rules.data || []).find((r) => r.job_type === jobType);
    setValues(existing
      ? Object.fromEntries(FIELDS.map((f) => [f.key, String(existing[f.key] ?? "")]))
      : EMPTY);
  }, [jobType, rules.data]);

  const configured = new Set((rules.data || []).map((r) => r.job_type));
  const preview = estimate(values);

  async function save(event) {
    event.preventDefault();
    await action.run(async () => {
      await upsertPricingRule(QUOTATION_URL, session.token, {
        job_type: jobType,
        ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])),
      });
      setToast("Pricing saved");
      await rules.reload();
    });
  }

  return (
    <main className="page">
      <PageHeader
        title="Pricing rules"
        subtitle="What the quotation engine charges. Set one rule per job type - a quote can't be generated without it."
      />

      {rules.error && <Alert onRetry={rules.reload}>{rules.error.message}</Alert>}
      {rules.loading && !rules.data && <Card><Loading label="Loading your rules…" /></Card>}

      <div className="split">
        <Card className="stack">
          <Segmented
            label="Job type"
            value={jobType}
            onChange={setJobType}
            options={JOB_TYPES.map((t) => ({ value: t.value, label: t.long }))}
          />

          <form className="stack" onSubmit={save}>
            {GROUPS.map((group) => (
              <div key={group} className="stack" style={{ gap: 10 }}>
                <span className="eyebrow">{group}</span>
                <div className="form-grid">
                  {FIELDS.filter((f) => f.group === group).map((f) => (
                    <Field key={f.key} label={`${f.label} (${f.unit})`} id={`rule-${f.key}`} hint={f.hint}>
                      <TextInput
                        id={`rule-${f.key}`}
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={values[f.key]}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
            {action.error && <Alert>{action.error}</Alert>}
            <Button type="submit" trailing="check" disabled={action.busy}>
              {action.busy ? "Saving…" : "Save pricing"}
            </Button>
          </form>
        </Card>

        <div className="stack">
          <Card className="stack">
            <CardHead title="Coverage" />
            {JOB_TYPES.map((t) => (
              <div key={t.value} className="list-row" style={{ cursor: "default" }}>
                <span style={{ fontWeight: 600 }}>{t.long}</span>
                <span className="end" style={{ marginLeft: "auto" }}>
                  {configured.has(t.value) ? <Badge tone="green">Set</Badge> : <Badge tone="red">Not set</Badge>}
                </span>
              </div>
            ))}
          </Card>

          <Card tone="dark" className="stack">
            <CardHead title="What a quote would look like" />
            {preview ? (
              <>
                <p className="muted">At your assumed depth of {values.assumed_depth_ft} ft, before any local water-table adjustment.</p>
                <div className="stack" style={{ gap: 0 }}>
                  {preview.items.map((item) => (
                    <div className="receipt-row" key={item.label}>
                      <span>{item.label}</span>
                      <span className="leader" />
                      <span className="amt">{formatInr(item.amount.toFixed(2))}</span>
                    </div>
                  ))}
                </div>
                <div className="inset" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="muted">Total{preview.floorApplied ? " (minimum charge applied)" : ""}</span>
                  <span className="num" style={{ fontSize: 26, fontWeight: 700, color: "var(--saffron)" }}>
                    {formatInr(preview.total.toFixed(2))}
                  </span>
                </div>
              </>
            ) : (
              <p className="muted">Fill in the fields to see a sample total. This preview is calculated in the browser - the real quote is always computed by the quotation service.</p>
            )}
          </Card>
        </div>
      </div>
      <Toast message={toast} />
    </main>
  );
}

// Mirrors services/quotation/app/pricing/engine.py for a live preview only.
// The backend stays the source of truth for any quote that is actually sent.
function estimate(values) {
  const nums = Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])]));
  if (FIELDS.some((f) => values[f.key] === "" || Number.isNaN(nums[f.key]))) return null;
  const depth = nums.assumed_depth_ft;
  const items = [
    { label: `Drilling · ${depth} ft`, amount: nums.base_rate_per_ft * depth },
    { label: `Casing · ${depth} ft`, amount: nums.casing_rate_per_ft * depth },
    { label: "Labour", amount: nums.labour_flat_fee },
    { label: "Transport", amount: nums.transport_flat_fee },
    { label: "Equipment", amount: nums.equipment_flat_fee },
    { label: "Installation", amount: nums.installation_flat_fee },
  ];
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const withMargin = subtotal + (subtotal * nums.margin_percent) / 100;
  const floorApplied = withMargin < nums.minimum_job_charge;
  return { items, total: floorApplied ? nums.minimum_job_charge : withMargin, floorApplied };
}
