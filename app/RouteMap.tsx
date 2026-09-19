"use client";

import {MapContainer, Marker, Polyline, TileLayer, useMap} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {useEffect, useMemo, useState} from "react";
import {getAirportByIata} from "airport-data-ts";

const icon = L.divIcon({
  className: "planeMarker",
  html: "<span>✈</span>",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

function Follow({position, live}:{position:[number,number]|null;live:boolean}) {
  const map = useMap();

  useEffect(() => {
    if (position && live) map.flyTo(position, 6, {duration: 0.7});
  }, [position, live, map]);

  return null;
}

function toTimestamp(value:any, timezone?:string) {
  if (!value) return null;
  const text=String(value);
  const direct=Date.parse(text);
  if (Number.isFinite(direct) && /(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) return direct;

  const match=text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [,day,hour,minute,second="00"]=match;

  if (!timezone) return Date.parse(`${day}T${hour}:${minute}:${second}Z`);

  const guess=Date.parse(`${day}T${hour}:${minute}:${second}Z`);
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date(guess));
  const get=(name:string)=>parts.find(p=>p.type===name)?.value||"00";
  const asUtc=Date.UTC(Number(get("year")),Number(get("month"))-1,Number(get("day")),Number(get("hour")),Number(get("minute")),Number(get("second")));
  return guess-(asUtc-guess);
}

function simulatePosition(departure:any,arrival:any,depCoords:[number,number]|null,arrCoords:[number,number]|null,now=Date.now()) {
  if (!depCoords || !arrCoords) return null;

  const startValue=departure?.actual||departure?.estimated||departure?.scheduled;
  const endValue=arrival?.actual||arrival?.estimated||arrival?.scheduled;
  const start=toTimestamp(startValue,departure?.timezone);
  const end=toTimestamp(endValue,arrival?.timezone);
  if (!start || !end || end<=start || now<start || now>end) return null;

  const progress=Math.max(0,Math.min(1,(now-start)/(end-start)));
  return {
    position:[
      depCoords[0]+(arrCoords[0]-depCoords[0])*progress,
      depCoords[1]+(arrCoords[1]-depCoords[1])*progress
    ] as [number,number],
    progress
  };
}

export default function RouteMap({live,departure,arrival}:{live:any;departure:any;arrival:any}) {
  const [now,setNow]=useState(Date.now());
  const [depCoords,setDepCoords]=useState<[number,number]|null>(null);
  const [arrCoords,setArrCoords]=useState<[number,number]|null>(null);

  useEffect(()=>{
    const id=setInterval(()=>setNow(Date.now()),15000);
    return()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    let cancelled=false;

    async function loadAirports() {
      try {
        const [dep,arr]=await Promise.all([
          departure?.iata ? getAirportByIata(departure.iata) : Promise.resolve([]),
          arrival?.iata ? getAirportByIata(arrival.iata) : Promise.resolve([])
        ]);

        const d=dep?.[0];
        const a=arr?.[0];

        if (!cancelled) {
          setDepCoords(d && Number.isFinite(Number(d.latitude)) && Number.isFinite(Number(d.longitude))
            ? [Number(d.latitude),Number(d.longitude)] : null);
          setArrCoords(a && Number.isFinite(Number(a.latitude)) && Number.isFinite(Number(a.longitude))
            ? [Number(a.latitude),Number(a.longitude)] : null);
        }
      } catch {
        if (!cancelled) {
          setDepCoords(null);
          setArrCoords(null);
        }
      }
    }

    loadAirports();
    return()=>{cancelled=true};
  },[departure?.iata,arrival?.iata]);

  const livePosition:[number,number]|null =
    live?.latitude!=null && live?.longitude!=null
      ? [Number(live.latitude),Number(live.longitude)] : null;

  const simulation=useMemo(
    ()=>livePosition ? null : simulatePosition(departure,arrival,depCoords,arrCoords,now),
    [livePosition,departure,arrival,depCoords,arrCoords,now]
  );

  const position=livePosition||simulation?.position||null;
  const isSimulated=!livePosition&&!!simulation;
  const center=position||depCoords||arrCoords||[20,0] as [number,number];
  const route=depCoords&&arrCoords
    ? (position ? [depCoords,position,arrCoords] : [depCoords,arrCoords])
    : position ? [position] : [];

  return (
    <div className="map">
      <MapContainer center={center} zoom={position ? 6 : depCoords&&arrCoords ? 5 : 2} scrollWheelZoom zoomControl>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {route.length>1&&(
          <Polyline
            positions={route as [number,number][]}
            pathOptions={{color:"#007aff",weight:4,dashArray:isSimulated?"7 8":undefined}}
          />
        )}
        {position&&<Marker position={position} icon={icon}/>}
        <Follow position={position} live={!!livePosition}/>
      </MapContainer>
      {isSimulated&&<div className="mapbadge">Estimated position</div>}
    </div>
  );
}
