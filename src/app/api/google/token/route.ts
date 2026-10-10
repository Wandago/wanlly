import { clerk, signedInUserId } from "@/lib/session";
import { SAY } from "@/lib/messages";

/** Google Drive access for "Save to Google Drive": only files Wanlly creates (drive.file). */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * The signed-in person's Google access token, if they've allowed Drive access. Tells the editor
 * to ask for permission when they haven't. The token only ever goes to the person it belongs to.
 */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  try {
    const { data } = await clerk().users.getUserOauthAccessToken(userId, "google");
    const t = data[0];
    if (!t) return Response.json({ connected: false });
    if (!t.scopes?.includes(DRIVE_SCOPE)) return Response.json({ connected: true, drive: false });
    return Response.json({ connected: true, drive: true, token: t.token }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("google token failed", e);
    return Response.json({ connected: false });
  }
}
