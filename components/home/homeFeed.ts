import type { HomeCardModel, HomeCardType } from "./HomeCard";

type HomeFeedInput = {
    now: number;
    lastSeenMs?: number;

    hasNewReviews: boolean;
    hasNewFlowers: boolean;
    hasUpdatedReviews: boolean;

    // Trending / Top rated should ideally be a real product
    trendingTitle?: string;
    trendingProductId?: string;
    trendingRating?: number | null;
    trendingRatingCount?: number | null;

    topRatedTitle?: string;
    topRatedProductId?: string;
    topRatedRating?: number | null;
    topRatedRatingCount?: number | null;

    badgeTitle?: string;
    badgeOwnerName?: string;

    // legacy (kept so nothing breaks if still passed)
    newsHeadline?: string;
    newsSource?: string;

    // Used for deterministic rotation
    seedKey: string;
};

function hashStringToInt(s: string) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

function pickOne<T>(items: T[], seed: number) {
    if (items.length === 0) return null;
    return items[seed % items.length];
}

function safeRating(n: any): number | null {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    if (n <= 0) return null;
    // clamp 0..5 (HomeCard expects 0..5 but shows only when >0)
    return Math.max(0, Math.min(5, n));
}

function safeCount(n: any): number | null {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    if (n <= 0) return null;
    return Math.floor(n);
}

export function buildHomeCards(
    input: HomeFeedInput,
    handlers: {
        goToNewReviews: () => void;
        goToNewFlowers: () => void;
        goToUpdatedReviews: () => void;

        // For specific flower navigation (Trending/Top Rated)
        goToFlower: (productId: string) => void;

        // Badges page
        goToBadges: () => void;

        // External link (MedBud Wiki stock)
        openMcStock: () => void;
    }
): { primary: HomeCardModel[]; news?: HomeCardModel } {
    const seed = hashStringToInt(input.seedKey);
    const primary: HomeCardModel[] = [];

    /* ---------------- Lane A: always fresh ---------------- */

    const laneA: Array<{ type: HomeCardType; card: HomeCardModel }> = [];

    if (input.hasNewReviews) {
        laneA.push({
            type: "new_review",
            card: {
                id: "laneA_new_review",
                type: "new_review",
                eyebrow: "New review",
                title: "New reviews",
                subtitle: "See what the community has posted",
                onPress: handlers.goToNewReviews,
            },
        });
    }

    if (input.hasNewFlowers) {
        laneA.push({
            type: "new_flower",
            card: {
                id: "laneA_new_flower",
                type: "new_flower",
                eyebrow: "New flower",
                title: "Recently added",
                subtitle: "Browse newly added flowers",
                onPress: handlers.goToNewFlowers,
            },
        });
    }

    if (input.hasUpdatedReviews) {
        laneA.push({
            type: "review_updated",
            card: {
                id: "laneA_review_updated",
                type: "review_updated",
                eyebrow: "Review updated",
                title: "Updated reviews",
                subtitle: "New notes have been added",
                onPress: handlers.goToUpdatedReviews,
            },
        });
    }

    const laneAChoice = pickOne(laneA, seed);
    if (laneAChoice) primary.push(laneAChoice.card);

    /* ---------------- Lane B: community activity ---------------- */

    const laneB: HomeCardModel[] = [];

    if (input.trendingTitle) {
        const pid = typeof input.trendingProductId === "string" ? input.trendingProductId : "";
        laneB.push({
            id: "laneB_trending",
            type: "trending",
            eyebrow: "Trending",
            title: input.trendingTitle,
            subtitle: "One of the most reviewed this week",
            rating: safeRating(input.trendingRating),
            ratingCount: safeCount(input.trendingRatingCount),
            onPress: () => {
                // If we have a real productId, go to that flower
                if (pid) handlers.goToFlower(pid);
                // Otherwise default back to the main flowers list
                else handlers.goToNewFlowers();
            },
        });
    }

    if (input.topRatedTitle) {
        const pid = typeof input.topRatedProductId === "string" ? input.topRatedProductId : "";
        laneB.push({
            id: "laneB_top_rated",
            type: "top_rated",
            eyebrow: "Top rated",
            title: input.topRatedTitle,
            subtitle: "Currently #1 by community reviews",
            rating: safeRating(input.topRatedRating),
            ratingCount: safeCount(input.topRatedRatingCount),
            onPress: () => {
                if (pid) handlers.goToFlower(pid);
                else handlers.goToNewFlowers();
            },
        });
    }

    const laneBChoice = pickOne(laneB, seed + 3);
    if (laneBChoice) primary.push(laneBChoice);

    /* ---------------- Lane C: recognition ---------------- */

    if (input.badgeTitle) {
        primary.push({
            id: "laneC_badge",
            type: "badge",
            eyebrow: "Badge earned",
            title: input.badgeTitle,
            subtitle: input.badgeOwnerName ? `Awarded to ${input.badgeOwnerName}` : "Awarded recently",
            // This is a page, not a flower
            onPress: handlers.goToBadges,
        });
    }

    /* ---------------- Bottom card: MC stock (replaces news) ----------------
       Keeping type as "news" so UI doesn't need refactor right now.
    */
    const news: HomeCardModel = {
        id: "mc_stock_1",
        type: "news",
        // remove eyebrow to avoid repeating "MC stock" twice
        eyebrow: undefined,
        title: "Check MC stock",
        subtitle: "Availability on MedBud Wiki",
        meta: "Opens website",
        onPress: handlers.openMcStock,
    };

    return { primary: primary.slice(0, 5), news };

}
