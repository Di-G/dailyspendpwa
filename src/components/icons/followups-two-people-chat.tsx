import * as React from "react";

export function FollowupsTwoPeopleChatIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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

      {/* Chat bubble (top-right) */}
      <path d="M14 5h6a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2l-1.2 1.2-.2-1.2H14a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      {/* Chat dots */}
      <circle cx="15.5" cy="8" r="0.5" />
      <circle cx="17" cy="8" r="0.5" />
      <circle cx="18.5" cy="8" r="0.5" />
    </svg>
  );
}

export default FollowupsTwoPeopleChatIcon;


