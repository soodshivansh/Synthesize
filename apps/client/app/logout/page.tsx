"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/auth";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    clearAuthToken();
    router.replace("/");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <div className="text-neutral-400">Logging out...</div>
    </div>
  );
}
