import * as React from "react";

export function FollowupsSeniorJuniorIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      stroke="none"
      className={className}
      {...props}
    >
      {/* Big person (left) */}
      <circle cx="8" cy="7" r="3.2" />
      <rect x="4.6" y="11" width="6.8" height="4.4" rx="2.2" />

      {/* Small person (right) */}
      <circle cx="18" cy="11" r="2.4" />
      <rect x="15.6" y="14.2" width="4.8" height="3.4" rx="1.7" />
    </svg>
  );
}

export default FollowupsSeniorJuniorIcon;


