import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PLATFORM_SPINE_URL, RESOURCE_NETWORK_URL, createJob, listServiceAreas,
  JOB_TYPES, PILOT_CENTER, formatCoords,
} from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon, { JobTypeIcon } from "../../components/Icon.jsx";
import SiteMap from "../../components/SiteMap.jsx";
import { Alert, Button, Card, Loading } from "../../components/ui.jsx";
import { useAction, useAreaName, useLoad } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";

export default function NewRequest() {
  const { session } = useSession();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  const [point, setPoint] = useState(PILOT_CENTER);
  const [jobType, setJobType] = useState("agricultural");
  const [locating, setLocating] = useState(false);

  const areas = useLoad(() => listServiceAreas(RESOURCE_NETWORK_URL, session.token), [session.token]);
  const area = useAreaName(point.lat, point.lng);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function submit() {
    await run(async () => {
      const job = await createJob(PLATFORM_SPINE_URL, session.token, {
        lat: point.lat, lng: point.lng, jobType,
      });
      navigate(`/customer/jobs/${job.job_id}`, { replace: true });
    });
  }

  return (
    <main className="page">
      <PageHeader
        back={{ to: "/customer", label: "Your borewells" }}
        title="Where should we drill?"
        subtitle="Drag the pin to your site. The closer it is, the better the depth estimate."
      />

      <div className="split">
        <Card className="map-frame" style={{ padding: 0, overflow: "hidden" }}>
          <SiteMap
            marker={point}
            draggableMarker
            onMove={setPoint}
            areas={areas.data || []}
            height={520}
            zoom={12}
          />
        </Card>

        <div className="stack">
          <Card className="stack">
            <div className="card-head" style={{ margin: 0 }}>
              <span className="tile-icon"><Icon name="pin" /></span>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 17 }}>
                  {area ? `${area.name}, ${area.district}` : "Outside the pilot areas"}
                </span>
                <span className="mono muted" style={{ fontSize: 12 }}>{formatCoords(point.lat, point.lng)}</span>
              </div>
            </div>
            {area ? (
              <div className="alert ok" role="status">
                <Icon name="drop" size={18} />
                <span>Water table here is around {area.estimated_water_depth_ft} ft (± {area.confidence_band_ft} ft), so your quote uses real local data.</span>
              </div>
            ) : (
              <div className="alert info" role="status">
                <Icon name="info" size={18} />
                <span>No depth data for this spot yet - your contractor will quote from their own assumed depth.</span>
              </div>
            )}
            <Button variant="light" icon="locate" onClick={useMyLocation} disabled={locating}>
              {locating ? "Finding you…" : "Use my current location"}
            </Button>
            {areas.loading && <Loading label="Loading pilot areas…" />}
          </Card>

          <Card className="stack">
            <h2 className="title-md">What is the borewell for?</h2>
            {JOB_TYPES.map((type) => {
              const on = jobType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  className="list-row"
                  aria-pressed={on}
                  onClick={() => setJobType(type.value)}
                  style={{ boxShadow: on ? "inset 0 0 0 2px var(--ink)" : "none", background: on ? "var(--surface)" : undefined }}
                >
                  <span className="tile-icon" style={{ background: on ? "var(--saffron)" : "var(--ground)" }}>
                    <JobTypeIcon jobType={type.value} />
                  </span>
                  <span className="stack" style={{ gap: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{type.label}</span>
                    <span className="muted" style={{ fontSize: 14 }}>{type.hint}</span>
                  </span>
                  <span className="end" style={{ marginLeft: "auto" }}>
                    {on ? <Icon name="check" size={20} strokeWidth={2.4} /> : null}
                  </span>
                </button>
              );
            })}
          </Card>

          {error && <Alert>{error}</Alert>}
          <Button size="lg" block trailing="arrowRight" onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Get my estimate"}
          </Button>
        </div>
      </div>
    </main>
  );
}
