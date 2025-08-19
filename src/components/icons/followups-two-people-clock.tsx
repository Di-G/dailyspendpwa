import * as React from "react";

export function FollowupsTwoPeopleClockIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Big person (left) */}
      <circle cx="8" cy="7" r="3" />
      <path d="M4 14c0-3 8-3 8 0" />

      {/* Small person (right) */}
      <circle cx="16.5" cy="10.5" r="2" />
      <path d="M14.5 16c0-2.2 4-2.2 4 0" />

      {/* Clock badge (pending follow-up) */}
      <circle cx="19" cy="6" r="2.2" />
      <path d="M19 5v1.2l.9.6" />
    </svg>
  );
}

export default FollowupsTwoPeopleClockIcon;


