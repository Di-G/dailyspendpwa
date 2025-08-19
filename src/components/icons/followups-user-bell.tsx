import * as React from "react";

export function FollowupsUserBellIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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
      {/* User head */}
      <circle cx="10" cy="8" r="3" />
      {/* User shoulders */}
      <path d="M3.5 18c0-3.6 13-3.6 13 0" />

      {/* Small bell badge on top-right */}
      {/* Bell body */}
      <path d="M18 8c-1.1 0-2 .9-2 2v.8l-.6 1.2h5.2L20 10.8V10c0-1.1-.9-2-2-2z" />
      {/* Clapper */}
      <path d="M18 14a.5.5 0 0 1-1 0" />
    </svg>
  );
}

export default FollowupsUserBellIcon;


