import { getGitHubUser } from "@/lib/github";
import { Navbar } from "./navbar";
import { ChatInterface } from "./chat-interface";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const user = await getGitHubUser();

  if (!user) {
    return (
      <div className="flex h-screen flex-col bg-black text-white">
        <Navbar />
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 text-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Synthesize</h1>
            </div>

            <p className="text-sm text-muted-foreground">
              Sign in with GitHub to continue
            </p>

            <form action="/api/auth/github" method="GET">
              <Button type="submit" className="w-full cursor-pointer">
                Login with GitHub
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Navbar user={user} />
      <ChatInterface />
    </div>
  );
}
