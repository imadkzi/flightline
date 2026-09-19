import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key=process.env.AIRLABS_API_KEY;
  if(!key)return NextResponse.json({error:"AIRLABS_API_KEY is not configured"},{status:500});
  const url=new URL("https://airlabs.co/api/v9/flights");
  url.searchParams.set("api_key",key);
  url.searchParams.set("status","en-route");
  url.searchParams.set("limit","8");
  url.searchParams.set("_fields","flight_iata,airline_iata,dep_iata,arr_iata,alt,speed,dir,status,aircraft_icao,reg_number,lat,lng");
  try{
    const r=await fetch(url.toString(),{cache:"no-store"});
    const j=await r.json();
    if(!r.ok||j.error)return NextResponse.json({error:j.error?.message||j.message||"Unable to load live flights"},{status:502});
    const flights=Array.isArray(j.response)?j.response:Array.isArray(j.data)?j.data:[];
    return NextResponse.json({
      fetchedAt:new Date().toISOString(),
      flights:flights.filter((f:any)=>f?.flight_iata||f?.dep_iata||f?.arr_iata).slice(0,8)
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Network error"},{status:502});
  }
}