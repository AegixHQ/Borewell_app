import { useState } from "react";
import { RESOURCE_NETWORK_URL, listServiceAreas, upsertServiceArea, PILOT_CENTER, formatCoords } from "shared-ui";
import { PageHeader } from "../../components/AppShell.jsx";
import Icon from "../../components/Icon.jsx";
import SiteMap from "../../components/SiteMap.jsx";
import { Alert, Button, Card, CardHead, EmptyState, Field, Loading, TextInput, Toast } from "../../components/ui.jsx";
import { useAction, useLoad, useToast } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.jsx";
import { clearAreaCache } from "../../lib/hooks.js";

const BLANK = {
  name: "", district: "Madurai", state: "Tamil Nadu",
  radius_km: "8", estimated_water_depth_ft: "", confidence_band_ft: "60",
};

export default function ServiceAreas() {
  const { session } = useSession();
  const [form, setForm] = useState(BLANK);
  const [point, setPoint] = useState(PILOT_CENTER);
  const [toast, setToast] = useToast();
  const action = useAction();

  const areas = useLoad(() => listServiceAreas(RESOURCE_NETWORK_URL, session.token), [session.token]);

  function editArea(area) {
    setForm({
      name: area.name,
      district: area.district,
      state: area.state,
      radius_km: String(area.radius_km),
      estimated_water_depth_ft: String(area.estimated_water_depth_ft),
      confidence_band_ft: String(area.confidence_band_ft),
    });
    setPoint({ lat: area.center_lat, lng: area.center_lng });
  }

  async function save(event) {
    event.preventDefault();
    await action.run(async () => {
      await upsertServiceArea(RESOURCE_NETWORK_URL, session.token, {
        name: form.name,
        district: form.district,
        state: form.state,
        center_lat: point.lat,
        center_lng: point.lng,
        radius_km: Number(form.radius_km),
        estimated_water_depth_ft: Number(form.estimated_water_depth_ft),
        confidence_band_ft: Number(form.confidence_band_ft),
      });
      clearAreaCache();
      setToast(`${form.name} saved`);
      setForm(BLANK);
      await areas.reload();
    });
  }

  return (
    <main className="page">
      <PageHeader
        title="Pilot service areas"
        subtitle="Water-table estimates per village. A job inside one of these gets a location-based depth range instead of your flat assumption."
      />

      {areas.error && <Alert onRetry={areas.reload}>{areas.error.message}</Alert>}

      <div className="split">
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <SiteMap
            marker={point}
            draggableMarker
            onMove={setPoint}
            areas={areas.data || []}
            center={point}
            zoom={10}
            height={520}
          />
        </Card>

        <div className="stack">
          <Card className="stack">
            <CardHead title="Add or update an area" />
            <p className="muted" style={{ fontSize: 14 }}>
              Click the map to place the centre. Saving a name that already exists updates it rather than adding a duplicate.
            </p>
            <form className="stack" onSubmit={save}>
              <Field label="Village / area name" id="area-name">
                <TextInput id="area-name" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kallikudi" />
              </Field>
              <div className="form-grid">
                <Field label="District" id="area-district">
                  <TextInput id="area-district" required value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })} />
                </Field>
                <Field label="State" id="area-state">
                  <TextInput id="area-state" required value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
                <Field label="Radius (km)" id="area-radius" hint="How far this estimate applies">
                  <TextInput id="area-radius" type="number" min="0.1" step="0.1" required value={form.radius_km}
                    onChange={(e) => setForm({ ...form, radius_km: e.target.value })} />
                </Field>
                <Field label="Water depth (ft)" id="area-depth">
                  <TextInput id="area-depth" type="number" min="1" step="1" required value={form.estimated_water_depth_ft}
                    onChange={(e) => setForm({ ...form, estimated_water_depth_ft: e.target.value })} />
                </Field>
                <Field label="Confidence band (± ft)" id="area-band">
                  <TextInput id="area-band" type="number" min="0" step="1" required value={form.confidence_band_ft}
                    onChange={(e) => setForm({ ...form, confidence_band_ft: e.target.value })} />
                </Field>
                <Field label="Centre" id="area-centre" hint="Drag the pin or click the map">
                  <TextInput id="area-centre" readOnly value={formatCoords(point.lat, point.lng)} />
                </Field>
              </div>
              {action.error && <Alert>{action.error}</Alert>}
              <Button type="submit" trailing="check" disabled={action.busy}>
                {action.busy ? "Saving…" : "Save area"}
              </Button>
            </form>
          </Card>

          <Card className="stack">
            <CardHead title={`Configured areas (${(areas.data || []).length})`} />
            {areas.loading && !areas.data && <Loading />}
            {areas.data && areas.data.length === 0 && (
              <EmptyState icon="map" title="No areas yet">
                Without an area, every quote falls back to your flat assumed depth.
              </EmptyState>
            )}
            {(areas.data || []).map((area) => (
              <button key={area.area_id} type="button" className="list-row" onClick={() => editArea(area)}>
                <span className="tile-icon"><Icon name="drop" /></span>
                <span className="stack" style={{ gap: 0 }}>
                  <span style={{ fontWeight: 600 }}>{area.name}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {area.district} · ~{area.estimated_water_depth_ft} ft ± {area.confidence_band_ft} · {area.radius_km} km
                  </span>
                </span>
                <span className="end" style={{ marginLeft: "auto" }}><Icon name="edit" size={18} /></span>
              </button>
            ))}
          </Card>
        </div>
      </div>
      <Toast message={toast} />
    </main>
  );
}
