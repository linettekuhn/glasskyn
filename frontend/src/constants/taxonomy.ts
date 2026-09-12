import type { Concern, ConcernCategory } from "@/types";
export const TAXONOMY_DISCLAIMER =
  "For tracking your own skin over time. Not a diagnosis. See a dermatologist for anything you're concerned about.";
const ACNE: Concern[] = [
  {
    id: "closed_comedone",
    label: "Closed comedone (whitehead)",
    category: "acne",
    imageUrl: require("../../assets/concerns/whitehead.png"),
    circleImageUrl: require("../../assets/concerns/whitehead_circle.png"),
    description:
      "A small skin-colored or slightly white bump where a pore is fully clogged and sealed. Unlike a blackhead, the pore stays closed, so it looks pale.",
  },
  {
    id: "open_comedone",
    label: "Open comedone (blackhead)",
    category: "acne",
    imageUrl: require("../../assets/concerns/blackhead.png"),
    circleImageUrl: require("../../assets/concerns/blackhead_circle.png"),
    description:
      "A small bump with a dark tip from pigment reacting with air inside an open pore. Unlike a whitehead, the pore stays open.",
  },
  {
    id: "papule",
    label: "Papule",
    category: "acne",
    imageUrl: require("../../assets/concerns/papule.png"),
    circleImageUrl: require("../../assets/concerns/papule_circle.png"),
    description:
      "A small, firm, red bump with no visible pus center. Clusters can make skin feel rough like sandpaper.",
  },
  {
    id: "pustule",
    label: "Pustule",
    category: "acne",
    imageUrl: require("../../assets/concerns/pustule.png"),
    circleImageUrl: require("../../assets/concerns/pustule_circle.png"),
    description:
      "An inflamed bump like a papule, but with a visible yellow or white pus-filled center.",
  },
  {
    id: "nodule",
    label: "Nodule",
    category: "acne",
    imageUrl: require("../../assets/concerns/nodule.png"),
    circleImageUrl: require("../../assets/concerns/nodule_circle.png"),
    description:
      "A solid, firm lump over about a centimeter across that sits deep in the skin. Unlike a cyst, it is solid throughout.",
  },
  {
    id: "cyst",
    label: "Cyst",
    category: "acne",
    imageUrl: require("../../assets/concerns/cyst.png"),
    circleImageUrl: require("../../assets/concerns/cyst_circle.png"),
    description:
      "A deep, large lump like a nodule, but filled with fluid or semi-fluid material, making it feel soft or squishy.",
  },
  {
    id: "milia",
    label: "Milia",
    category: "acne",
    imageUrl: require("../../assets/concerns/millia.png"),
    circleImageUrl: require("../../assets/concerns/millia_circle.png"),
    description:
      "Tiny, firm, pearly-white bumps under intact skin, most common around the eyelids and cheeks. They are keratin-filled cysts, not clogged acne pores.",
  },
  {
    id: "fungal_acne",
    label: "Fungal acne",
    category: "acne",
    imageUrl: require("../../assets/concerns/fungal.png"),
    circleImageUrl: require("../../assets/concerns/fungal_circle.png"),
    description:
      "Small, uniform, inflamed bumps caused by yeast overgrowth in hair follicles. Distinctly itchy, with bumps that are similar in size.",
  },
];
const PIGMENTATION: Concern[] = [
  {
    id: "pih",
    label: "Post-inflammatory hyperpigmentation (PIH)",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/pih.png"),
    circleImageUrl: require("../../assets/concerns/pih_circle.png"),
    description:
      "Flat tan, brown, or black spots left where skin was inflamed or injured. The color is brown, tan, or black rather than red, which separates it from PIE.",
  },
  {
    id: "pie",
    label: "Post-inflammatory erythema (PIE)",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/pie.png"),
    circleImageUrl: require("../../assets/concerns/pie_circle.png"),
    description:
      "Flat red or pink marks left after a spot heals. The color is red or pink rather than brown, which separates it from PIH.",
  },
  {
    id: "melasma",
    label: "Melasma",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/melasma.png"),
    circleImageUrl: require("../../assets/concerns/melasma_circle.png"),
    description:
      "Blotchy, darker patches, often brown, mainly on the cheeks, forehead, chin, and above the upper lip. Usually larger and more symmetrical than sunspots or freckles.",
  },
  {
    id: "sunspots",
    label: "Sunspots (solar lentigines)",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/sunspot.png"),
    circleImageUrl: require("../../assets/concerns/sunspots_circle.png"),
    description:
      "Flat, clearly defined brown spots, usually on the face and hands, caused by sun exposure.",
  },
];
const TEXTURE: Concern[] = [
  {
    id: "atrophic_scarring",
    label: "Atrophic acne scarring",
    category: "texture",
    imageUrl: require("../../assets/concerns/scarring.png"),
    circleImageUrl: require("../../assets/concerns/scarring_circle.png"),
    description:
      "A depression or pit left when too little collagen forms while healing from acne. Types include ice pick, boxcar, and rolling scars.",
  },
  {
    id: "hypertrophic_scarring",
    label: "Raised (hypertrophic/keloid) scarring",
    category: "texture",
    imageUrl: require("../../assets/concerns/keloid.png"),
    circleImageUrl: require("../../assets/concerns/keloid_circle.png"),
    description:
      "A firm, raised scar formed when skin makes too much collagen while healing. Keloids grow larger than the original blemish.",
  },
  {
    id: "enlarged_pores",
    label: "Enlarged pores / uneven texture",
    category: "texture",
    imageUrl: require("../../assets/concerns/pores.png"),
    circleImageUrl: require("../../assets/concerns/pores_circle.png"),
    description:
      "Visible pores that are larger than typical across an area of skin. Often associated with acne and can happen at any age or skin tone.",
  },
  {
    id: "fine_lines_wrinkles",
    label: "Fine lines / wrinkles",
    category: "texture",
    imageUrl: require("../../assets/concerns/wrinkles.png"),
    circleImageUrl: require("../../assets/concerns/wrinkles_circle.png"),
    description:
      "Creases, folds, or furrows that develop gradually with age, often along natural expression lines like the forehead, eye corners, and mouth.",
  },
];
export const TAXONOMY: Concern[] = [...ACNE, ...PIGMENTATION, ...TEXTURE];
export const TAXONOMY_GROUPS: {
  category: ConcernCategory;
  label: string;
  items: Concern[];
}[] = [
  { category: "acne", label: "Acne", items: ACNE },
  { category: "pigmentation", label: "Pigmentation", items: PIGMENTATION },
  { category: "texture", label: "Texture", items: TEXTURE },
];
