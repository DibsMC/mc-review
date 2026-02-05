export type BadgeTier = "bronze" | "silver" | "gold" | "emerald" | "platinum";

export type CommunityBadge = {
    id: string;
    title: string;
    subtitle: string;
    emoji: string;
    tier: BadgeTier;
};

/**
 * Badge rules:
 * Reviews written: 1, 10, 25, 50, 100
 * Helpful received: 1, 10, 25, 50, 100
 * Stop at 100.
 */
export function getUnlockedBadges(args: {
    reviewsWritten: number;
    helpfulReceived: number;
}): CommunityBadge[] {
    const { reviewsWritten, helpfulReceived } = args;

    const badges: CommunityBadge[] = [];

    // Reviews written milestones
    if (reviewsWritten >= 1) {
        badges.push({
            id: "reviews_1",
            title: "Contributor",
            subtitle: "Posted your first review",
            emoji: "🪴",
            tier: "bronze",
        });
    }
    if (reviewsWritten >= 10) {
        badges.push({
            id: "reviews_10",
            title: "Regular Reviewer",
            subtitle: "10+ reviews written",
            emoji: "✍️",
            tier: "silver",
        });
    }
    if (reviewsWritten >= 25) {
        badges.push({
            id: "reviews_25",
            title: "Super Reviewer",
            subtitle: "25+ reviews written",
            emoji: "🏅",
            tier: "gold",
        });
    }
    if (reviewsWritten >= 50) {
        badges.push({
            id: "reviews_50",
            title: "Top Reviewer",
            subtitle: "50+ reviews written",
            emoji: "🏆",
            tier: "emerald",
        });
    }
    if (reviewsWritten >= 100) {
        badges.push({
            id: "reviews_100",
            title: "Legend",
            subtitle: "100+ reviews written",
            emoji: "👑",
            tier: "platinum",
        });
    }

    // Helpful received milestones
    if (helpfulReceived >= 1) {
        badges.push({
            id: "helpful_1",
            title: "Helpful",
            subtitle: "Received your first helpful vote",
            emoji: "👍",
            tier: "bronze",
        });
    }
    if (helpfulReceived >= 10) {
        badges.push({
            id: "helpful_10",
            title: "Trusted",
            subtitle: "10+ helpful votes received",
            emoji: "🤝",
            tier: "silver",
        });
    }
    if (helpfulReceived >= 25) {
        badges.push({
            id: "helpful_25",
            title: "Highly Rated",
            subtitle: "25+ helpful votes received",
            emoji: "⭐",
            tier: "gold",
        });
    }
    if (helpfulReceived >= 50) {
        badges.push({
            id: "helpful_50",
            title: "Community Favourite",
            subtitle: "50+ helpful votes received",
            emoji: "💛",
            tier: "emerald",
        });
    }
    if (helpfulReceived >= 100) {
        badges.push({
            id: "helpful_100",
            title: "Most Helpful",
            subtitle: "100+ helpful votes received",
            emoji: "🔥",
            tier: "platinum",
        });
    }

    // Sort: higher tiers first, stable by id
    const tierRank: Record<BadgeTier, number> = {
        bronze: 1,
        silver: 2,
        gold: 3,
        emerald: 4,
        platinum: 5,
    };

    badges.sort((a, b) => {
        const diff = tierRank[b.tier] - tierRank[a.tier];
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    return badges;
}
