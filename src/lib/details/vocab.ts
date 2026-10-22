/**
 * The words the DB already uses for these fields, taken from DB-mvp's data (2026-10-21). Drafts pick
 * from these so the DB doesn't grow near-duplicates ("skincare" / "skin care"); the importer accepts new
 * words too, so a reviewer can still type one.
 */

export const TIERS = ["luxury", "premium", "masstige"] as const;

/**
 * Exactly the industries the Digital Beauty site filters brands by (production /web/filters/brands,
 * 2026-10-22). Words outside it ("bodycare", "beauty") made industries the site doesn't offer.
 */
export const INDUSTRIES = ["apparel", "accessories", "footwear", "jewelry", "makeup", "fragrances", "skincare", "haircare", "sportswear"] as const;

/** The DB uses "global" for most brands; the rest name where a brand mainly sells. */
export const REGIONS = ["global", "north america", "europe", "asia", "middle east", "latin america"] as const;

export const AESTHETICS = [
  "accessible", "alp-chic", "american", "architectural", "artistic", "avant-garde",
  "body-positive", "bohemian", "bold", "botanical", "boundary-breaking", "california-cool",
  "celebrity-owned", "cheerful", "classic", "clean", "colorful", "conceptual", "conscious",
  "couture", "craftsmanship", "cultural", "curated", "cute", "deconstructivist", "denim-focused",
  "distressed", "eclectic", "eco-chic", "educational", "effective", "effortless", "elegant",
  "exotic", "feminine", "full-coverage", "futuristic", "gentle", "glam", "glamorous", "glossy",
  "glowy", "golden", "handcrafted", "heritage", "heritage-rich", "honey-infused", "humanistic",
  "iconic", "inclusive", "industrial", "innovative", "innovative-fabric", "intellectual",
  "intense", "italian-craftsmanship", "joyful", "k-beauty", "lab-chic", "leather-heritage",
  "magical", "maximalist", "millennial-pink", "minimalist", "modern", "narrative", "nostalgic",
  "opulent", "oriental", "parisian", "performance-driven", "perfumer-focused", "personalized",
  "playful", "pop", "pop-culture", "practical", "pro-artistry", "pro-level", "professional",
  "provocative", "quirky", "raw-denim", "rebellious", "refined", "retro", "retro-modern",
  "retro-sport", "rich", "romantic", "scandi-cool", "scientific", "sculpted", "sculptural",
  "seductive", "sicilian", "sleek", "soft", "soulful", "space-age", "streetwear",
  "streetwear-influence", "subversive", "sunny", "sustainable", "sweet", "tech-forward",
  "tech-infused", "technical", "timeless", "traditional", "trendy", "tropical", "unconventional",
  "understated", "utilitarian", "vibrant", "whimsical", "youthful",
] as const;
