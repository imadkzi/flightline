"use client";

import {useCallback, useEffect, useState} from "react";
import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="map loading">Loading live map…</div>
});

const time = (value: any) => {
  if (!value) return "—";
  const match = String(value).match(/T(\d{2}:\d{2})/);
  return match?.[1] || "—";
};

const date = (value: any) => {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return "";
  return new Date(match[1] + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short"
  });
};

const num = (value: any, suffix = "") =>
  value == null ? "—" : `${Math.round(Number(value)).toLocaleString()}${suffix}`;

export default function Flightline() {
  const [flight, setFlight] = useState<any>(null);
  const [flightNumber, setFlightNumber] = useState("FR4776");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [last, setLast] = useState("");

  const refresh = useCallback(async (requestedFlight?: string) => {
    const code = (requestedFlight || flightNumber).trim().toUpperCase();
    if (!code) return;

    setLoading(true);
    setErr("");

    try {
      const r = await fetch(`/api/flight-status?flight=${encodeURIComponent(code)}`, {
        cache: "no-store"
      });
      const j = await r.json();

      if (!r.ok) throw Error(j.error || "Unable to load flight");

      setFlight(j.flight);
      setFlightNumber(j.flight?.flight?.iata || j.flight?.flight?.icao || code);
      setLast(new Date(j.fetchedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }));
    } catch (e) {
      setFlight(null);
      setErr(e instanceof Error ? e.message : "Unable to load flight");
    } finally {
      setLoading(false);
    }
  }, [flightNumber]);

  useEffect(() => {
    refresh("FR4776");
  }, []);

  useEffect(() => {
    if (!auto || !flight) return;
    const id = setInterval(() => refresh(), 60000);
    return () => clearInterval(id);
  }, [auto, flight, refresh]);

  const live = flight?.live;
  const departure = flight?.departure;
  const arrival = flight?.arrival;
  const status = flight?.flight_status || "scheduled";
  const isLive = live?.latitude != null && live?.longitude != null;

  const statusText =
    status === "active" ? "In flight" :
    status === "landed" ? "Landed" :
    status === "cancelled" ? "Cancelled" :
    status === "incident" ? "Incident" :
    Number(departure?.delay || 0) > 0 ? "Delayed" :
    "On time";

  const departureTime = departure?.actual || departure?.estimated || departure?.scheduled;
  const arrivalTime = arrival?.actual || arrival?.estimated || arrival?.scheduled;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    refresh();
  };

  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div className="ey">FLIGHTLINE · LIVE TRACKING</div>
          <h1>{flight?.flight?.iata || flightNumber || "Flightline"}</h1>
        </div>
        <div className={`pill ${statusText === "Delayed" || statusText === "Cancelled" ? "warn" : statusText === "In flight" ? "blue" : "ok"}`}>
          <i /> {statusText}
        </div>
      </header>

      <form className="search" onSubmit={submit}>
        <input
          value={flightNumber}
          onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
          placeholder="Flight number e.g. FR4776"
          aria-label="Flight number"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search flight"}
        </button>
      </form>

      {flight && (
        <>
          <section className="card route">
            <div>
              <b>{departure?.iata || "—"}</b>
              <span>{departure?.airport || "Departure airport"}</span>
              <small>{date(departureTime)} · {time(departureTime)}</small>
            </div>
            <div className="arrow">✈</div>
            <div className="right">
              <b>{arrival?.iata || "—"}</b>
              <span>{arrival?.airport || "Arrival airport"}</span>
              <small>{date(arrivalTime)} · {time(arrivalTime)}</small>
            </div>
          </section>

          <section className="card">
            <RouteMap live={live} departure={departure} arrival={arrival} />
            <div className="mapfoot">
              <div>
                <small>POSITION</small>
                <strong>
                  {isLive
                    ? `${Number(live.latitude).toFixed(4)}, ${Number(live.longitude).toFixed(4)}`
                    : "Not airborne"}
                </strong>
              </div>
              <div className="right">
                <small>API UPDATED</small>
                <strong>{last || "—"}</strong>
              </div>
            </div>
          </section>

          <section className="grid">
            <div className="stat">
              <small>DEPARTURE</small>
              <strong>{time(departureTime)}</strong>
              <em>
                {departure?.actual ? "Actual" :
                  departure?.estimated ? "Estimated" :
                  departure?.delay ? `${departure.delay} min delay` : "Scheduled"}
              </em>
            </div>
            <div className="stat">
              <small>ARRIVAL</small>
              <strong>{time(arrivalTime)}</strong>
              <em>
                {arrival?.actual ? "Actual" :
                  arrival?.estimated ? "Estimated" :
                  arrival?.delay ? `${arrival.delay} min delay` : "Scheduled"}
              </em>
            </div>
            <div className="stat">
              <small>ALTITUDE</small>
              <strong>{isLive ? num(live.altitude, " ft") : "—"}</strong>
            </div>
            <div className="stat">
              <small>SPEED</small>
              <strong>{isLive ? num(live.speed_horizontal, " km/h") : "—"}</strong>
            </div>
          </section>

          <section className="card details">
            <h2>Flight details</h2>
            <div className="detailsgrid">
              <div><small>AIRLINE</small><strong>{flight?.airline?.name || "—"}</strong></div>
              <div><small>AIRCRAFT</small><strong>{flight?.aircraft?.iata || flight?.aircraft?.icao || "—"}</strong></div>
              <div><small>REGISTRATION</small><strong>{flight?.aircraft?.registration || "—"}</strong></div>
              <div><small>DEPARTURE GATE</small><strong>{departure?.gate || "—"}</strong></div>
              <div><small>DEPARTURE TERMINAL</small><strong>{departure?.terminal || "—"}</strong></div>
              <div><small>ARRIVAL GATE</small><strong>{arrival?.gate || "—"}</strong></div>
              <div><small>ARRIVAL TERMINAL</small><strong>{arrival?.terminal || "—"}</strong></div>
              <div><small>STATUS</small><strong>{statusText}</strong></div>
            </div>
          </section>

          <div className="actions">
            <button onClick={() => refresh()} disabled={loading}>
              {loading ? "Refreshing…" : "↻ Refresh now"}
            </button>
            <button className={auto ? "active" : ""} onClick={() => setAuto((v) => !v)}>
              {auto ? "● Auto-refresh 60s" : "○ Auto-refresh off"}
            </button>
          </div>
        </>
      )}

      {err && <div className="error">{err}</div>}
      <footer>Live data via Aviationstack · Server-side API proxy · Last update {last || "—"}</footer>
    </main>
  );
}
