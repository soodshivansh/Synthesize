import GitHubLogin from "./GitHubLogin";
import { getGitHubUser } from "../lib/github";

export default async function Home() {
  const user = await getGitHubUser();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-xl bg-white shadow-lg p-8 text-center">
        {user ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-800">
              Hi, {user.name || user.login} 👋
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              You are logged in with GitHub
            </p>

            <form
              action="/api/auth/logout"
              method="post"
              className="mt-6"
            >
              <button
                type="submit"
                className="w-full rounded-lg bg-red-500 px-4 py-3 text-white font-medium hover:bg-red-600 transition"
              >
                Logout
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-800">
              GitHub OAuth
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Sign in to continue
            </p>

            <div className="mt-6">
              <GitHubLogin />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
