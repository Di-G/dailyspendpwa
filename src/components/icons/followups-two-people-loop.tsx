import * as React from "react";

export function FollowupsTwoPeopleLoopIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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

      {/* Loop arrow badge (ongoing follow-up) */}
      <path d="M18 4.6a2.6 2.6 0 1 1-1.9 4.5" />
      <path d="M15.9 8.9l.6-1.5 1.5.6" />
    </svg>
  );
}

export default FollowupsTwoPeopleLoopIcon;


