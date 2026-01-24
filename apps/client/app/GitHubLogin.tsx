"use client";

const GitHubLogin = () => {
  const handleLogin = () => {
    window.location.href = "/api/auth/github";
  };

  return (
    <button onClick={handleLogin}>
      Login with GitHub
    </button>
  );
};

export default GitHubLogin;
