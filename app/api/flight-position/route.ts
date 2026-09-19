import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const {searchParams}=new URL(request.url);
  const callsign=searchParams.get("callsign")?.trim().toUpperCase().replace(/\s+/g,"");
  if(!callsign)return NextResponse.json({error:"A flight callsign is required."},{status:400});
  try {
    const response=await fetch("https://api.adsb.lol/v2/callsign/"+encodeURIComponent(callsign),{cache:"no-store",headers:{accept:"application/json"}});
    if(!response.ok)return NextResponse.json({error:"ADSB position unavailable",source:"adsb.lol"},{status:404});
    const data=await response.json();
    const ac=data?.ac?.[0];
    if(!ac)return NextResponse.json({error:"No live ADS-B position found for "+callsign,source:"adsb.lol"},{status:404});
    return NextResponse.json({
      fetchedAt:new Date().toISOString(),source:"adsb.lol",
      live:{
        latitude:ac.lat??null,longitude:ac.lon??null,
        altitude:typeof ac.alt_geom==="number"?ac.alt_geom:ac.alt_baro??null,
        altitude_baro:ac.alt_baro??null,
        speed_horizontal:typeof ac.gs==="number"?ac.gs*1.852:null,
        speed_knots:ac.gs??null,direction:ac.track??null,vertical_speed:ac.baro_rate??null,
        updated:ac.seen_pos??ac.seen??null,hex:ac.hex??null,registration:ac.r??null,
        aircraft_type:ac.t??null,callsign:ac.flight?.trim()||callsign,on_ground:ac.alt_baro==="ground"
      }
    });
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:"ADSB network error",source:"adsb.lol"},{status:502}); }
}