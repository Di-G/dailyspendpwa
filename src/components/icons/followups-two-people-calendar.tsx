import * as React from "react";

export function FollowupsTwoPeopleCalendarIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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

      {/* Calendar badge (top-right) */}
      <path d="M17 3.8v1.6" />
      <path d="M20 3.8v1.6" />
      <rect x="15.2" y="5.2" width="7" height="5.6" rx="1.2" />
      {/* Optional small date dot */}
      <circle cx="18.7" cy="8" r="0.6" />
    </svg>
  );
}

export default FollowupsTwoPeopleCalendarIcon;


