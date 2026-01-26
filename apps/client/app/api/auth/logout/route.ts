import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("github_access_token");
  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_BASE_URL)
  );
}
