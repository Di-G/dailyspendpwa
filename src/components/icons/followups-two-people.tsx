import * as React from "react";

export function FollowupsTwoPeopleIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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
      {/* Big person (left, solid) */}
      <circle cx="8" cy="7" r="3.2" />
      <rect x="4.6" y="10.8" width="6.8" height="4.6" rx="2.3" />

      {/* Small person (right, solid) */}
      <circle cx="17.5" cy="11" r="2.4" />
      <rect x="15.1" y="14" width="4.8" height="3.6" rx="1.8" />
    </svg>
  );
}

export default FollowupsTwoPeopleIcon;


