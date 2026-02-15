"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthToken } from "@/lib/auth";

function AuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (token) {
      setAuthToken(token, 60 * 60 * 1000);
      // Dispatch storage event to notify navbar
      window.dispatchEvent(new Event('storage'));
      router.replace("/chat");
    } else {
      router.replace("/");
    }
  }, [searchParams, router]);

  return (
    <div className="text-neutral-400">Completing authentication...</div>
  );
}

export default function AuthCompletePage() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <Suspense fallback={<div className="text-neutral-400">Loading...</div>}>
        <AuthCompleteContent />
      </Suspense>
    </div>
  );
}
