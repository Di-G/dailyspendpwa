import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formats monetary values without trailing decimals unless needed.
// Shows up to 2 decimal places only when the value has a fractional part.
export function formatAmountDisplay(value: number): string {
  if (Number.isNaN(value)) return "0";
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}
