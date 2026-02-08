"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import { Navbar } from "./navbar";

interface GitHubUser {
  name?: string;
  login: string;
  avatar_url?: string;
}

export function ClientNavbar() {
  const [user, setUser] = useState<GitHubUser | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };

    fetchUser();
  }, []);

  return <Navbar user={user || undefined} />;
}
