export type AutoCapitalize = "none" | "sentences" | "words" | "characters";

export function capitalizeWords(value: string): string {
  return value.replace(
    /\S+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );
}

export function capitalizeSentences(value: string): string {
  return value.replace(
    /(^|[.!?]\s+)(\p{L})/gu,
    (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
  );
}

export function applyAutoCapitalize(
  value: string,
  mode: AutoCapitalize,
): string {
  switch (mode) {
    case "characters":
      return value.toUpperCase();
    case "words":
      return capitalizeWords(value);
    case "sentences":
      return capitalizeSentences(value);
    default:
      return value;
  }
}
