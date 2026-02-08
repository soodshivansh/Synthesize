"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthToken } from "@/lib/auth";

export default function AuthCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (token) {
      // Store token with 1 hour expiry
      setAuthToken(token, 60 * 60 * 1000);
      // Clear token from URL and redirect to chat
      router.replace("/chat");
    } else {
      router.replace("/");
    }
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <div className="text-neutral-400">Completing authentication...</div>
    </div>
  );
}
