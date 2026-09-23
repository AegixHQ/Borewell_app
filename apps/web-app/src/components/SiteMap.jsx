import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PILOT_CENTER } from "shared-ui";

/**
 * Leaflet map used for picking a job/resource location and for showing a
 * site with its pilot service area.
 *
 * Note for anyone extending this: POST /v1/resources/match does NOT return
 * lat/lng for the resources it ranks (only distance_km - see
 * packages/contracts/openapi/resource-network.yaml), so nearby rigs cannot
 * be drawn as pins yet. That needs a backend change, not a frontend one.
 */
export default function SiteMap({
  center,
  zoom = 12,
  marker,
  draggableMarker = false,
  onMove,
  circle,
  areas = [],
  height = 260,
  interactive = true,
  className = "",
}) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const areaLayerRef = useRef(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const start = center || marker || PILOT_CENTER;
    const map = L.map(nodeRef.current, {
      center: [start.lat, start.lng],
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: false,
      doubleClickZoom: interactive,
      attributionControl: true,
      keyboard: interactive,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapRef.current = map;

    if (interactive && onMoveRef.current) {
      map.on("click", (e) => onMoveRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }
    // Leaflet needs a size recalculation when it mounts inside a flex/grid
    // parent that lays out after the map is created.
    setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !marker) return;
    const icon = L.divIcon({ className: "", html: '<div class="pin-site"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    if (!markerRef.current) {
      markerRef.current = L.marker([marker.lat, marker.lng], { icon, draggable: draggableMarker, keyboard: false }).addTo(map);
      if (draggableMarker) {
        markerRef.current.on("dragend", (e) => {
          const { lat, lng } = e.target.getLatLng();
          onMoveRef.current?.({ lat, lng });
        });
      }
    } else {
      markerRef.current.setLatLng([marker.lat, marker.lng]);
    }
  }, [marker, draggableMarker]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }
    if (circle) {
      circleRef.current = L.circle([circle.lat, circle.lng], {
        radius: circle.radiusKm * 1000,
        color: "#141619",
        weight: 1,
        dashArray: "4 5",
        fillColor: "#141619",
        fillOpacity: 0.05,
      }).addTo(map);
    }
  }, [circle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    areaLayerRef.current?.remove();
    if (!areas.length) { areaLayerRef.current = null; return; }
    const group = L.layerGroup();
    areas.forEach((a) => {
      L.circle([a.center_lat, a.center_lng], {
        radius: (a.radius_km || 1) * 1000,
        color: "#F0A73A",
        weight: 1.5,
        fillColor: "#F0A73A",
        fillOpacity: 0.12,
      }).bindTooltip(`${a.name} · ~${a.estimated_water_depth_ft} ft`).addTo(group);
      L.marker([a.center_lat, a.center_lng], {
        icon: L.divIcon({ className: "", html: '<div class="pin-area"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
      }).addTo(group);
    });
    group.addTo(map);
    areaLayerRef.current = group;
  }, [areas]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && center) map.setView([center.lat, center.lng], zoom);
  }, [center, zoom]);

  return <div ref={nodeRef} className={`map ${className}`} style={{ height }} />;
}
