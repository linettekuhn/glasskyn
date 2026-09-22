import type { Product } from "@/types";
import type { Colors } from "@/constants/theme";

export type ExpiryTier = "expired" | "critical" | "warning";

export const EXPIRY_TIERS = {
  expired: 0,
  critical: 2,
  warning: 7,
} as const;

export function getExpiryTier(days: number | null | undefined): ExpiryTier | null {
  if (days === null || days === undefined) return null;
  if (days < 0) return "expired";
  if (days <= EXPIRY_TIERS.critical) return "critical";
  if (days <= EXPIRY_TIERS.warning) return "warning";
  return null;
}

export function expirySubtext(days: number): string {
  if (days < 0) {
    const ago = -days;
    return ago === 1 ? "Expired 1 day ago" : `Expired ${ago} days ago`;
  }
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}

export function isExpiringSoon(product: Product): boolean {
  return getExpiryTier(product.days_until_expiry) !== null;
}

export function sortByExpiry(a: Product, b: Product): number {
  const ad = a.days_until_expiry ?? 0;
  const bd = b.days_until_expiry ?? 0;
  return ad - bd;
}

export function sortByExpiryPriority(a: Product, b: Product): number {
  const rank = (d: number | null | undefined) =>
    d === null || d === undefined ? 2 : d > 30 ? 1 : 0;
  const ar = rank(a.days_until_expiry);
  const br = rank(b.days_until_expiry);
  if (ar !== br) return ar - br;
  if (ar === 0) return (a.days_until_expiry as number) - (b.days_until_expiry as number);
  return a.name.localeCompare(b.name);
}

export function tierColor(tier: ExpiryTier, colors: (typeof Colors)["light"]): string {
  if (tier === "expired" || tier === "critical") return colors.error;
  return colors.warning;
}
