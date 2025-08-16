import { ReactNode } from "react";

export default function VerifiedGate({ children }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{children}</>;
}


