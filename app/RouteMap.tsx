"use client";

import {MapContainer, Marker, Polyline, TileLayer, useMap} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {useEffect} from "react";

const icon = L.divIcon({
  className: "planeMarker",
  html: "<span>✈</span>",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

function Follow({live}: {live: any}) {
  const map = useMap();

  useEffect(() => {
    if (live?.latitude != null && live?.longitude != null) {
      map.flyTo([Number(live.latitude), Number(live.longitude)], 6, {duration: 0.7});
    }
  }, [live, map]);

  return null;
}

export default function RouteMap({
  live,
  departure,
  arrival
}: {
  live: any;
  departure: any;
  arrival: any;
}) {
  const dep: [number, number] | null =
    departure?.latitude != null && departure?.longitude != null
      ? [Number(departure.latitude), Number(departure.longitude)]
      : null;

  const arr: [number, number] | null =
    arrival?.latitude != null && arrival?.longitude != null
      ? [Number(arrival.latitude), Number(arrival.longitude)]
      : null;

  const pos: [number, number] | null =
    live?.latitude != null && live?.longitude != null
      ? [Number(live.latitude), Number(live.longitude)]
      : null;

  const fallback: [number, number] = [20, 0];
  const center = pos || dep || arr || fallback;
  const route = dep && arr ? (pos ? [dep, pos, arr] : [dep, arr]) : pos ? [pos] : [];

  return (
    <div className="map">
      <MapContainer center={center} zoom={pos ? 6 : dep && arr ? 5 : 2} scrollWheelZoom zoomControl>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route.length > 1 && (
          <Polyline
            positions={route as [number, number][]}
            pathOptions={{color: "#007aff", weight: 4, dashArray: pos ? undefined : "7 8"}}
          />
        )}
        {pos && <Marker position={pos} icon={icon} />}
        <Follow live={live} />
      </MapContainer>
    </div>
  );
}
