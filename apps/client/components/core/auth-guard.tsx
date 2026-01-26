import { getGitHubUser } from "@/lib/github";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export async function AuthGuard({ children }: { children: ReactNode }) {
  const user = await getGitHubUser();
  
  if (!user) {
    redirect("/");
  }
  
  return <>{children}</>;
}
