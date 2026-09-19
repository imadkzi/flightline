"use client";

import {MapContainer, Marker, Polyline, TileLayer, useMap} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {useEffect, useMemo} from "react";

const icon = L.divIcon({
  className: "planeMarker",
  html: "<span>✈</span>",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

function Follow({position, live}:{position:[number,number]|null;live:boolean}) {
  const map = useMap();

  useEffect(() => {
    if (position && live) {
      map.flyTo(position, 6, {duration: 0.7});
    }
  }, [position, live, map]);

  return null;
}

function toTimestamp(value:any, timezone?:string) {
  if (!value) return null;
  const text = String(value);
  const direct = Date.parse(text);
  if (Number.isFinite(direct) && /(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) return direct;

  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const [, day, hour, minute, second = "00"] = match;
  if (!timezone) return Date.parse(`${day}T${hour}:${minute}:${second}Z`);

  const guess = Date.parse(`${day}T${hour}:${minute}:${second}Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"
  }).formatToParts(new Date(guess));
  const get=(name:string)=>parts.find(p=>p.type===name)?.value || "00";
  const asUtc=Date.UTC(Number(get("year")),Number(get("month"))-1,Number(get("day")),Number(get("hour")),Number(get("minute")),Number(get("second")));
  return guess - (asUtc - guess);
}

function simulatePosition(departure:any, arrival:any, now=Date.now()) {
  const depLat=Number(departure?.latitude), depLon=Number(departure?.longitude);
  const arrLat=Number(arrival?.latitude), arrLon=Number(arrival?.longitude);
  if (![depLat,depLon,arrLat,arrLon].every(Number.isFinite)) return null;

  const startValue=departure?.actual || departure?.estimated || departure?.scheduled;
  const endValue=arrival?.actual || arrival?.estimated || arrival?.scheduled;
  const start=toTimestamp(startValue, departure?.timezone);
  const end=toTimestamp(endValue, arrival?.timezone);
  if (!start || !end || end <= start) return null;

  const now=Date.now();
  if (now < start || now > end) return null;

  const progress=Math.max(0,Math.min(1,(now-start)/(end-start)));
  return {
    position:[depLat+(arrLat-depLat)*progress, depLon+(arrLon-depLon)*progress] as [number,number],
    progress
  };
}

export default function RouteMap({
  live,
  departure,
  arrival
}: {
  live:any;
  departure:any;
  arrival:any;
}) {
  const dep: [number,number]|null =
    departure?.latitude != null && departure?.longitude != null
      ? [Number(departure.latitude),Number(departure.longitude)] : null;

  const arr: [number,number]|null =
    arrival?.latitude != null && arrival?.longitude != null
      ? [Number(arrival.latitude),Number(arrival.longitude)] : null;

  const livePosition: [number,number]|null =
    live?.latitude != null && live?.longitude != null
      ? [Number(live.latitude),Number(live.longitude)] : null;

  const simulation=useMemo(
    () => livePosition ? null : simulatePosition(departure,arrival),
    [livePosition,departure,arrival]
  );

  const position=livePosition || simulation?.position || null;
  const isSimulated=!livePosition && !!simulation;
  const fallback: [number,number]=[20,0];
  const center=position || dep || arr || fallback;
  const route=dep && arr ? (position ? [dep,position,arr] : [dep,arr]) : position ? [position] : [];

  return (
    <div className="map">
      <MapContainer center={center} zoom={position ? 6 : dep && arr ? 5 : 2} scrollWheelZoom zoomControl>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route.length > 1 && (
          <Polyline
            positions={route as [number,number][]}
            pathOptions={{
              color:"#007aff",
              weight:4,
              dashArray:isSimulated ? "7 8" : undefined
            }}
          />
        )}
        {position && <Marker position={position} icon={icon} />}
        <Follow position={position} live={!!livePosition} />
      </MapContainer>
      {isSimulated && <div className="mapbadge">Estimated position</div>}
    </div>
  );
}
