import {NextResponse} from "next/server";
import {getMultipleAirports} from "airport-data-ts";

export const dynamic = "force-dynamic";

const timezoneCache = new Map<string,string>();

async function resolveTimezones(depIata:string|null,arrIata:string|null,depTimezone?:string|null,arrTimezone?:string|null){
  const result={departure:depTimezone||null,arrival:arrTimezone||null};
  const missing=[depIata,arrIata]
    .filter((code):code is string=>!!code)
    .filter(code=>!timezoneCache.has(code));

  if(missing.length){
    try{
      const airports=await getMultipleAirports([...new Set(missing)]);
      airports.forEach((airport:any)=>{
        if(airport?.iata&&airport?.time)timezoneCache.set(airport.iata,airport.time);
      });
    }catch{}
  }

  if(!result.departure&&depIata)result.departure=timezoneCache.get(depIata)||null;
  if(!result.arrival&&arrIata)result.arrival=timezoneCache.get(arrIata)||null;
  return result;
}

function instant(utcValue:any,ts:any){
  if(ts!=null&&Number.isFinite(Number(ts)))return new Date(Number(ts)*1000).toISOString();
  if(utcValue==null)return null;
  const s=String(utcValue).trim();
  return s?s.replace(" ","T")+"Z":null;
}

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

    const timezones=await resolveTimezones(f.dep_iata||null,f.arr_iata||null,f.dep_timezone||null,f.arr_timezone||null);

    const flight={
      flight_status:f.status||"scheduled",
      flight:{iata:f.flight_iata||rawFlight,icao:f.flight_icao||null,number:f.flight_number||null,callsign:f.flight_icao||(f.airline_icao&&f.flight_number?f.airline_icao+f.flight_number:null)},
      airline:{name:f.airline_name||null,iata:f.airline_iata||null,icao:f.airline_icao||null},
      departure:{
        iata:f.dep_iata||null,icao:f.dep_icao||null,airport:f.dep_name||f.dep_airport||null,
        terminal:f.dep_terminal||null,gate:f.dep_gate||null,
        scheduled:instant(f.dep_time_utc,f.dep_time_ts),
        estimated:instant(f.dep_estimated_utc,f.dep_estimated_ts),
        actual:instant(f.dep_actual_utc,f.dep_actual_ts),
        delay:f.dep_delayed??null,timezone:timezones.departure
      },
      arrival:{
        iata:f.arr_iata||null,icao:f.arr_icao||null,airport:f.arr_name||f.arr_airport||null,
        terminal:f.arr_terminal||null,gate:f.arr_gate||null,
        scheduled:instant(f.arr_time_utc,f.arr_time_ts),
        estimated:instant(f.arr_estimated_utc,f.arr_estimated_ts),
        actual:instant(f.arr_actual_utc,f.arr_actual_ts),
        delay:f.arr_delayed??null,timezone:timezones.arrival
      },
      live:{latitude:f.lat??null,longitude:f.lng??null,altitude:f.alt??null,speed_horizontal:f.speed??null,direction:f.dir??null,vertical_speed:f.v_speed??null,updated:f.updated??null,hex:f.hex??null},
      aircraft:{iata:f.aircraft_iata||null,icao:f.aircraft_icao||null,registration:f.reg_number||f.registration||null},
      raw:f
    };
    return NextResponse.json({fetchedAt:new Date().toISOString(),source:"airlabs",flight});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Network error"},{status:502})}
}