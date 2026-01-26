import { cookies } from "next/headers";

export async function getGitHubUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("github_access_token")?.value;
    if (!token) return null;
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user;
  } catch (error) {
    console.error("Error fetching GitHub user:", error);
    return null;
  }
}
