import type { Concern, ConcernCategory } from "@/types";

export const TAXONOMY_DISCLAIMER =
  "For tracking your own skin over time. Not a diagnosis — see a dermatologist for anything you're concerned about.";

const ACNE: Concern[] = [
  {
    id: "closed_comedone",
    label: "Closed comedone (whitehead)",
    category: "acne",
    imageUrl: require("../../assets/concerns/whitehead.png"),
    description:
      "A small bump the same color as your skin or slightly white, where a pore is fully clogged and sealed shut — nothing inside is exposed to air, so it's not inflamed or tender. Unlike a blackhead, the pore stays closed, which is why it looks pale instead of dark.",
  },
  {
    id: "open_comedone",
    label: "Open comedone (blackhead)",
    category: "acne",
    imageUrl: require("../../assets/concerns/blackhead.png"),
    description:
      "A small bump with a dark tip visible at the surface. The dark color comes from pigment reacting with air inside an open pore — not trapped dirt. Unlike a whitehead, the pore opening stays visible and open rather than sealed shut.",
  },
  {
    id: "papule",
    label: "Papule",
    category: "acne",
    imageUrl: require("../../assets/concerns/papule.png"),
    description:
      "A small, firm, red bump; a cluster can make skin feel rough like sandpaper. Solid all the way through, with no visible pus center — that's what separates it from a pustule.",
  },
  {
    id: "pustule",
    label: "Pustule",
    category: "acne",
    imageUrl: require("../../assets/concerns/pustule.png"),
    description:
      "Looks like a papule, but with a yellow or white pus-filled center visible at the surface. Same inflamed-bump stage as a papule, just further along.",
  },
  {
    id: "nodule",
    label: "Nodule",
    category: "acne",
    imageUrl: require("../../assets/concerns/nodule.png"),
    description:
      "A solid, firm lump over about a centimeter across, sitting deep in the skin. Penetrates deep enough that it often leaves a permanent scar. Unlike a cyst, it's solid throughout — nothing fluid-filled underneath.",
  },
  {
    id: "cyst",
    label: "Cyst",
    category: "acne",
    imageUrl: require("../../assets/concerns/cyst.png"),
    description:
      "A deep, large lump like a nodule, but filled with fluid or semi-fluid material, so it feels soft or squishy rather than solid. Like nodules, cysts often leave a permanent scar.",
  },
  {
    id: "milia",
    label: "Milia",
    category: "acne",
    imageUrl: require("../../assets/concerns/millia.png"),
    description:
      "Tiny, firm, pearly-white bumps just under the surface of the skin, most common around the eyelids and cheeks. Harmless keratin-filled cysts, unrelated to clogged acne pores — they sit under intact skin rather than at a pore opening.",
  },
  {
    id: "fungal_acne",
    label: "Fungal acne",
    category: "acne",
    imageUrl: require("../../assets/concerns/fungal.png"),
    description:
      "Looks acne-like — small, uniform, inflamed bumps — but is caused by yeast overgrowth in hair follicles. Distinctly itchy, which ordinary acne generally isn't; that itch plus bumps that all look similar in size is the main tell.",
  },
];

const PIGMENTATION: Concern[] = [
  {
    id: "pih",
    label: "Post-inflammatory hyperpigmentation (PIH)",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/pih.png"),
    description:
      "Flat, dark spots — tan, brown, or black — left behind where skin was inflamed or injured. Temporary but can take a long time to fade, and shows up more in darker skin tones. The color is brown/tan/black, not red — that's the difference from PIE.",
  },
  {
    id: "pie",
    label: "Post-inflammatory erythema (PIE)",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/pie.png"),
    description:
      "Flat, red or pink marks left behind after a spot heals, most visible in lighter skin tones. The color is red or pink rather than brown — a leftover redness, not a pigment change, which is what separates it from PIH.",
  },
  {
    id: "melasma",
    label: "Melasma",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/melasma.png"),
    description:
      "Blotchy, darker patches or spots — often freckle-like — mainly on the cheeks, forehead, chin, and above the upper lip. Usually brown, can look bluish-gray in darker skin tones. Tends to appear as larger, symmetrical patches rather than small distinct dots, which is what separates it from sunspots or freckles.",
  },
  {
    id: "sunspots",
    label: "Sunspots (solar lentigines)",
    category: "pigmentation",
    imageUrl: require("../../assets/concerns/sunspot.png"),
    description:
      "Flat, brown spots, larger and more clearly defined than freckles, usually on the face and hands. Caused by sun exposure, showing up from middle age onward. Unlike freckles, they don't fade in winter — they persist year-round.",
  },
];

const TEXTURE: Concern[] = [
  {
    id: "atrophic_scarring",
    label: "Atrophic acne scarring",
    category: "texture",
    imageUrl: require("../../assets/concerns/scarring.png"),
    description:
      "A depression or pit left where too little collagen formed while healing from acne. Narrow and sharp-edged (ice pick), wide with a defined edge (boxcar), or wide with a soft sloping edge (rolling) are the three sub-types.",
  },
  {
    id: "hypertrophic_scarring",
    label: "Raised (hypertrophic/keloid) scarring",
    category: "texture",
    imageUrl: require("../../assets/concerns/keloid.png"),
    description:
      "A firm, raised scar that forms when skin makes too much collagen while healing — more common in darker skin tones. Keloids specifically grow larger than the original blemish and often show up on the jawline, chest, or back. Raised and firm to the touch, rather than a pit or depression, is the tell vs. atrophic scarring.",
  },
  {
    id: "enlarged_pores",
    label: "Enlarged pores / uneven texture",
    category: "texture",
    imageUrl: require("../../assets/concerns/pores.png"),
    description:
      "Visible openings in the skin larger than typical, where oil and sweat reach the surface. Can happen at any age or skin tone, though some ethnic backgrounds and older age tend toward larger pores; often associated with acne. This is about the visible size of pores across an area of skin, not a single clogged pore.",
  },
  {
    id: "fine_lines_wrinkles",
    label: "Fine lines / wrinkles",
    category: "texture",
    imageUrl: require("../../assets/concerns/wrinkles.png"),
    description:
      "Creases, folds, or furrows that develop with age, with severity shaped by genetics, skin type, and sun exposure. Follows the skin's natural expression lines (forehead, eye corners, mouth) and appears gradually with age, rather than sitting at the site of one specific healed blemish — that's the tell vs. acne scarring.",
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