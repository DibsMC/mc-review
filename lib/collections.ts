export const COLLECTIONS = {
  PRODUCTS: "products",
  REVIEWS: "reviews",
  USERS: "users",
} as const;

export const CATEGORIES = ["flower", "vape", "oil", "pastille"] as const;
export type Category = (typeof CATEGORIES)[number];
