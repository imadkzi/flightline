import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = process.env.AVIATIONSTACK_ACCESS_KEY;
  if (!key) return NextResponse.json({error: "AVIATIONSTACK_ACCESS_KEY is not configured"}, {status: 500});

  const {searchParams} = new URL(request.url);
  const rawFlight = searchParams.get("flight")?.trim().toUpperCase().replace(/\s+/g, "");
  if (!rawFlight) return NextResponse.json({error: "Enter a flight number, e.g. FR4776 or BA138"}, {status: 400});

  const url = new URL("https://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", key);
  url.searchParams.set("limit", "10");

  if (/^[A-Z]{2}\d{1,4}$/.test(rawFlight)) {
    url.searchParams.set("flight_iata", rawFlight);
  } else if (/^[A-Z0-9]{3}\d{1,4}$/.test(rawFlight)) {
    url.searchParams.set("flight_icao", rawFlight);
  } else {
    return NextResponse.json({error: "Use an IATA flight number such as FR4776 or BA138."}, {status: 400});
  }

  try {
    const r = await fetch(url.toString(), {cache: "no-store"});
    const j = await r.json();

    if (!r.ok || j.error) {
      return NextResponse.json(
        {error: j.error?.message || "Aviationstack request failed", provider: j.error || null},
        {status: 502}
      );
    }

    const flights = Array.isArray(j.data) ? j.data : [];
    const flight = flights.find((item: any) => item?.flight_status === "active")
      || flights.find((item: any) => item?.flight_status === "scheduled")
      || flights[0]
      || null;

    if (!flight) {
      return NextResponse.json({error: "No Aviationstack flight data found for " + rawFlight + "."}, {status: 404});
    }

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      source: "aviationstack",
      flight
    });
  } catch (e) {
    return NextResponse.json({error: e instanceof Error ? e.message : "Network error"}, {status: 502});
  }
}
