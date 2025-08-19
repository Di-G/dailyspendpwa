import * as React from "react";

export function TripsPeopleIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Center head and shoulders (even larger) */}
      <circle cx="12" cy="6.0" r="3.4" />
      <path d="M6.5 13.2Q12 10.6 17.5 13.2" />

      {/* Left head and shoulders (bigger, slightly back) */}
      <circle cx="4.8" cy="8.4" r="2.6" />
      <path d="M1.8 13.6Q4.8 12.0 7.8 13.6" />

      {/* Right head and shoulders (bigger, slightly back) */}
      <circle cx="19.2" cy="8.4" r="2.6" />
      <path d="M16.2 13.6Q19.2 12.0 22.2 13.6" />

      {/* Base arc to ground the trio (widest footprint) */}
      <path d="M2 18Q12 22 22 18" />
    </svg>
  );
}

export default TripsPeopleIcon;


