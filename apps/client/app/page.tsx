import LoginPage from "@/components/core/login-page";
import { redirect } from "next/navigation";
import { getGitHubUser } from "@/lib/github";

export default async function Home() {
  const user = await getGitHubUser();

  if (!user) {
    return <LoginPage />;
  }

  redirect("/chat");
}
