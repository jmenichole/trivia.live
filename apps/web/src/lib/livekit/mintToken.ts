import { AccessToken } from "livekit-server-sdk";

export type LiveKitRole = "host" | "player";

export async function mintLiveKitToken(opts: {
  room: string;
  identity: string;
  role: LiveKitRole;
}): Promise<{ token: string; url: string }> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    throw new Error("LiveKit not configured");
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    ttl: 60 * 60 * 2, // 2 hours
  });

  if (opts.role === "host") {
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: true,
      canSubscribe: true,
    });
  } else {
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: false,
      canSubscribe: true,
    });
  }

  return { token: await at.toJwt(), url };
}
