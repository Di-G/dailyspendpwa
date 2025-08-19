import * as React from "react";

export function FollowupsTwoPeopleClipboardIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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

      {/* Clipboard badge (top-right) */}
      <rect x="15.2" y="4.8" width="6.0" height="6.0" rx="1" />
      {/* Clip */}
      <path d="M17.4 4.2h1.6" />
      {/* Lines */}
      <path d="M16.4 6.8h3.6" />
      <path d="M16.4 8.2h3.6" />
    </svg>
  );
}

export default FollowupsTwoPeopleClipboardIcon;


