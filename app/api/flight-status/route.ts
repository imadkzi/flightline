import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = process.env.AIRLABS_API_KEY;
  if (!key) return NextResponse.json({error:"AIRLABS_API_KEY is not configured"},{status:500});
  const {searchParams}=new URL(request.url);
  const rawFlight=searchParams.get("flight")?.trim().toUpperCase().replace(/\s+/g,"");
  if(!rawFlight)return NextResponse.json({error:"Enter a flight number, e.g. FR4776 or BA138"},{status:400});
  const isIata=/^[A-Z]{2}\d{1,4}$/.test(rawFlight),isIcao=/^[A-Z0-9]{3}\d{1,4}$/.test(rawFlight);
  if(!isIata&&!isIcao)return NextResponse.json({error:"Use an IATA flight number such as FR4776 or BA138."},{status:400});
  const url=new URL("https://airlabs.co/api/v9/flight");
  url.searchParams.set("api_key",key);url.searchParams.set(isIata?"flight_iata":"flight_icao",rawFlight);
  try{
    const r=await fetch(url.toString(),{cache:"no-store"});const j=await r.json();
    if(!r.ok||j.error)return NextResponse.json({error:j.error?.message||j.message||"AirLabs request failed"},{status:502});
    const f=j.response||j.data||null;
    if(!f)return NextResponse.json({error:"No AirLabs flight data found for "+rawFlight+"."},{status:404});
    const flight={
      flight_status:f.status||"scheduled",
      flight:{iata:f.flight_iata||rawFlight,icao:f.flight_icao||null,number:f.flight_number||null,callsign:f.flight_icao||(f.airline_icao&&f.flight_number?f.airline_icao+f.flight_number:null)},
      airline:{name:f.airline_name||null,iata:f.airline_iata||null,icao:f.airline_icao||null},
      departure:{iata:f.dep_iata||null,icao:f.dep_icao||null,airport:f.dep_name||f.dep_airport||null,terminal:f.dep_terminal||null,gate:f.dep_gate||null,scheduled:f.dep_time_utc||f.dep_time||null,estimated:f.dep_estimated_utc||f.dep_estimated||null,actual:f.dep_actual_utc||f.dep_actual||null,delay:f.dep_delayed??null,timezone:f.dep_timezone||null},
      arrival:{iata:f.arr_iata||null,icao:f.arr_icao||null,airport:f.arr_name||f.arr_airport||null,terminal:f.arr_terminal||null,gate:f.arr_gate||null,scheduled:f.arr_time_utc||f.arr_time||null,estimated:f.arr_estimated_utc||f.arr_estimated||null,actual:f.arr_actual_utc||f.arr_actual||null,delay:f.arr_delayed??null,timezone:f.arr_timezone||null},
      live:{latitude:f.lat??null,longitude:f.lng??null,altitude:f.alt??null,speed_horizontal:f.speed??null,direction:f.dir??null,vertical_speed:f.v_speed??null,updated:f.updated??null,hex:f.hex??null},
      aircraft:{iata:f.aircraft_iata||null,icao:f.aircraft_icao||null,registration:f.reg_number||f.registration||null},
      raw:f
    };
    return NextResponse.json({fetchedAt:new Date().toISOString(),source:"airlabs",flight});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Network error"},{status:502})}
}