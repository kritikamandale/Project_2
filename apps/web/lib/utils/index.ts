import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

/**
 * Masks an email address for privacy and security.
 * Example: "suhanimandale135@gmail.com" -> "su***35@gmail.com"
 * Example: "john.doe@company.org" -> "jo***oe@company.org"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  if (local.length <= 4) {
    return `${local[0]}**${local[local.length - 1]}@${domain}`;
  }
  const visibleStart = local.slice(0, 2);
  const visibleEnd = local.slice(-2);
  return `${visibleStart}***${visibleEnd}@${domain}`;
}
