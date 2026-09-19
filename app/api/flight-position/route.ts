import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

type Source = "ADSB.lol" | "Airplanes.live";

function normalize(ac:any, source:Source) {
  if (!ac || ac.lat == null || ac.lon == null) return null;
  return {
    fetchedAt:new Date().toISOString(),
    source,
    live:{
      latitude:ac.lat,
      longitude:ac.lon,
      altitude:typeof ac.alt_geom==="number"?ac.alt_geom:typeof ac.alt_baro==="number"?ac.alt_baro:null,
      altitude_baro:typeof ac.alt_baro==="number"?ac.alt_baro:null,
      speed_horizontal:typeof ac.gs==="number"?ac.gs*1.852:null,
      speed_knots:typeof ac.gs==="number"?ac.gs:null,
      direction:typeof ac.track==="number"?ac.track:null,
      vertical_speed:typeof ac.baro_rate==="number"?ac.baro_rate:null,
      updated:ac.seen_pos??ac.seen??null,
      hex:ac.hex??null,
      registration:ac.r??null,
      aircraft_type:ac.t??null,
      callsign:typeof ac.flight==="string"?ac.flight.trim():null,
      on_ground:ac.alt_baro==="ground"
    }
  };
}

async function lookup(base:string, kind:string, value:string, source:Source) {
  try {
    const r=await fetch(base+"/v2/"+kind+"/"+encodeURIComponent(value),{cache:"no-store",headers:{accept:"application/json"}});
    if(!r.ok)return null;
    const data=await r.json();
    const aircraft=Array.isArray(data?.ac)?data.ac[0]:data?.ac;
    return normalize(aircraft,source);
  } catch { return null; }
}

export async function GET(request:Request) {
  const {searchParams}=new URL(request.url);
  const hex=searchParams.get("hex")?.trim().toUpperCase();
  const callsign=searchParams.get("callsign")?.trim().toUpperCase().replace(/\s+/g,"");
  const registration=searchParams.get("registration")?.trim().toUpperCase();
  if(!hex&&!callsign&&!registration)return NextResponse.json({error:"An aircraft identifier is required."},{status:400});

  const sources:[string,Source][]=[
    ["https://api.adsb.lol","ADSB.lol"],
    ["https://api.airplanes.live","Airplanes.live"]
  ];

  // Hex is the aircraft's permanent Mode-S identifier, so try it first.
  for(const [base,source] of sources){
    if(hex){const result=await lookup(base,"hex",hex,source);if(result)return NextResponse.json(result);}
  }

  // Callsign is the next-best live identifier.
  for(const [base,source] of sources){
    if(callsign){const result=await lookup(base,"callsign",callsign,source);if(result)return NextResponse.json(result);}
  }

  // Registration is a useful final fallback when the callsign is not being broadcast.
  for(const [base,source] of sources){
    if(registration){const result=await lookup(base,"reg",registration,source);if(result)return NextResponse.json(result);}
  }

  return NextResponse.json({error:"No live ADS-B position found.",source:"ADSB.lol/Airplanes.live"},{status:404});
}