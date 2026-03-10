// import { AccessToken } from "livekit-server-sdk";
// import { NextRequest, NextResponse } from "next/server";

// export async function GET(req: NextRequest) {
//   const room = req.nextUrl.searchParams.get("room") ?? "voice-room";
//   const username = req.nextUrl.searchParams.get("username") ?? "user";

//   const apiKey = process.env.LIVEKIT_API_KEY;
//   const apiSecret = process.env.LIVEKIT_API_SECRET;

//   if (!apiKey || !apiSecret) {
//     return NextResponse.json(
//       { error: "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set" },
//       { status: 500 }
//     );
//   }

//   const at = new AccessToken(apiKey, apiSecret, {
//     identity: username,
//     ttl: "1h",
//   });

//   at.addGrant({
//     room,
//     roomJoin: true,
//     canPublish: true,
//     canSubscribe: true,
//   });

//   const token = await at.toJwt();
//   return NextResponse.json({ token });
// }


// webapp/src/app/api/token/route.ts

import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room") ?? "voice-room";
  const username = req.nextUrl.searchParams.get("username") ?? "user";

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  console.log("ENV CHECK:", { apiKey: !!apiKey, apiSecret: !!apiSecret, livekitUrl });

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "Missing env vars" },
      { status: 500 }
    );
  }

  try {
    const dispatchClient = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
    await dispatchClient.createDispatch(room, "my-agent");
  } catch (err) {
    console.error("Dispatch error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    ttl: "1h",
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token });
}