import { NextResponse } from "next/server";

export async function POST() {
  // Redirect to logout page which will clear localStorage
  return NextResponse.redirect(
    new URL("/logout", process.env.NEXT_PUBLIC_BASE_URL)
  );
}

export async function GET() {
  return NextResponse.redirect(
    new URL("/logout", process.env.NEXT_PUBLIC_BASE_URL)
  );
}
