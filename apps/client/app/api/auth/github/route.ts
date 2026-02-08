import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomUUID();
  const githubAuthUrl = new URL(
    "https://github.com/login/oauth/authorize"
  );
  githubAuthUrl.searchParams.set(
    "client_id",
    process.env.GITHUB_CLIENT_ID
  );
  githubAuthUrl.searchParams.set(
    "scope",
    "repo read:user"
  );
  githubAuthUrl.searchParams.set("state", state);
  const response = NextResponse.redirect(githubAuthUrl.toString());
  response.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}
