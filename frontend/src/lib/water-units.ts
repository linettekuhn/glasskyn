export const OZ_TO_ML = 29.5735;
export const LB_TO_KG = 0.45359237;

export function mlToOz(ml: number): number {
  return ml / OZ_TO_ML;
}

export function ozToMl(oz: number): number {
  return Math.round(oz * OZ_TO_ML);
}

export function lbToKg(lb: number): number {
  return lb * LB_TO_KG;
}

export function kgToLb(kg: number): number {
  return kg / LB_TO_KG;
}

export function roundTo10(ml: number): number {
  return Math.round(ml / 10) * 10;
}

export function recommendedOz(
  weightLb: number,
  activity: string | null,
  climate: string | null,
): number {
  const base = weightLb * 0.5;
  const activityBonus =
    activity === "moderate" ? 8 : activity === "active" ? 16 : 0;
  const climateBonus = climate === "hot" ? 8 : 0;
  return Math.max(0, Math.round(base + activityBonus + climateBonus));
}
