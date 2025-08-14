import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export default function VerifiedGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isVerified } = useAuth();
  if (!isVerified) return <>{fallback || null}</>;
  return <>{children}</>;
}


