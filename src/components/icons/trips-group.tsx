import * as React from "react";

export function TripsGroupIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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
      {/* Heads (slight side/top perspective) */}
      <ellipse cx="12" cy="5.6" rx="2.4" ry="2.0" />
      <ellipse cx="5.8" cy="15.0" rx="2.4" ry="1.9" transform="rotate(12 5.8 15.0)" />
      <ellipse cx="18.2" cy="14.2" rx="2.4" ry="1.9" transform="rotate(-12 18.2 14.2)" />

      {/* Shoulder/torso hints under each head (slightly asymmetric for perspective) */}
      <path d="M10.2 7.4Q12 8.6 13.8 7.4" />
      <path d="M4.0 16.0Q5.6 17.2 7.2 16.6" />
      <path d="M20.0 15.8Q18.6 16.8 16.8 16.4" />

      {/* Arms/hand connections forming a rounded triangle (holding hands) */}
      {/* Bottom sweeping arc (bigger footprint) */}
      <path d="M6.8 14Q12 19 17.2 14" />
      {/* Right to top connection */}
      <path d="M17.4 13.0Q14.8 9.8 13.0 7.6" />
      {/* Left to top connection */}
      <path d="M6.6 13.4Q9.2 9.8 11.0 7.6" />

      {/* Small wrist/hand cues near joins */}
      <path d="M15.6 13.5Q16.3 13.9 17.0 14.0" />
      <path d="M7.0 14.0Q7.7 13.9 8.4 13.5" />
      <path d="M12 8.0Q12.6 7.6 13.0 7.6" />
    </svg>
  );
}

export default TripsGroupIcon;


