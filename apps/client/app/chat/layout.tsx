import { AuthGuard } from "../../components/core/auth-guard";
import { ReactNode } from "react";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
