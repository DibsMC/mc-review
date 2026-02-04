export type CommunityBadgeId =
    | "contributor"
    | "regular"
    | "super_reviewer"
    | "top_reviewer"
    | "legend";

export type CommunityBadge = {
    id: CommunityBadgeId;
    title: string;
    subtitle: string;
    minReviews: number;
};

export const COMMUNITY_BADGES: CommunityBadge[] = [
    {
        id: "contributor",
        title: "Contributor",
        subtitle: "Posted your first review",
        minReviews: 1,
    },
    {
        id: "regular",
        title: "Regular",
        subtitle: "5+ reviews written",
        minReviews: 5,
    },
    {
        id: "super_reviewer",
        title: "Super Reviewer",
        subtitle: "15+ reviews written",
        minReviews: 15,
    },
    {
        id: "top_reviewer",
        title: "Top Reviewer",
        subtitle: "25+ reviews written",
        minReviews: 25,
    },
    {
        id: "legend",
        title: "Legend",
        subtitle: "50+ reviews written",
        minReviews: 50,
    },
];

export function getUnlockedBadges(reviewCount: number): CommunityBadge[] {
    if (!Number.isFinite(reviewCount) || reviewCount <= 0) return [];
    return COMMUNITY_BADGES.filter((b) => reviewCount >= b.minReviews);
}
