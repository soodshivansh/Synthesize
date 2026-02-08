import { Button } from "../ui/button";

export default function LoginPage() {
    return (
        <div className="flex h-full w-full items-center justify-center px-4 bg-neutral-950">
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
    );
}