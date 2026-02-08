import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cookieStore = await cookies();

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const storedState = cookieStore.get("github_oauth_state")?.value;

  console.log('OAuth callback:', { code: !!code, state, storedState });

  if (!code || !state || state !== storedState) {
    console.error('OAuth state mismatch:', { hasCode: !!code, hasState: !!state, stateMatch: state === storedState });
    return new NextResponse("Invalid OAuth state", { status: 401 });
  }

  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    }
  );

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return new NextResponse("Failed to get access token", {
      status: 400,
    });
  }

  cookieStore.delete("github_oauth_state");

  // Redirect to auth-complete page with token (will be stored in localStorage)
  const redirectUrl = new URL("/auth-complete", req.url);
  redirectUrl.searchParams.set("token", tokenData.access_token);
  
  return NextResponse.redirect(redirectUrl);
}
