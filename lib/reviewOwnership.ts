export type ReviewOwnerIdentity = {
    uid?: string | null;
    displayName?: string | null;
    email?: string | null;
    legacyUserIds?: Array<string | null | undefined> | null;
    legacyNames?: Array<string | null | undefined> | null;
    legacyEmails?: Array<string | null | undefined> | null;
};

type ReviewIdentityRecord = {
    userId?: unknown;
    uid?: unknown;
    authorUid?: unknown;
    displayName?: unknown;
    authorName?: unknown;
    userName?: unknown;
    email?: unknown;
    authorEmail?: unknown;
    userEmail?: unknown;
    helpfulCount?: unknown;
    productId?: unknown;
};

function normalizeToken(value: unknown) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildTokenSet(values: Array<unknown>) {
    const set = new Set<string>();
    values.forEach((value) => {
        const token = normalizeToken(value);
        if (token) set.add(token);
    });
    return set;
}

export function reviewMatchesIdentity(
    review: ReviewIdentityRecord,
    identity: ReviewOwnerIdentity
) {
    const uidTokens = buildTokenSet([identity.uid, ...(identity.legacyUserIds ?? [])]);
    const nameTokens = buildTokenSet([identity.displayName, ...(identity.legacyNames ?? [])]);
    const emailTokens = buildTokenSet([identity.email, ...(identity.legacyEmails ?? [])]);

    const reviewUidTokens = buildTokenSet([review.userId, review.uid, review.authorUid]);
    const reviewNameTokens = buildTokenSet([
        review.displayName,
        review.authorName,
        review.userName,
    ]);
    const reviewEmailTokens = buildTokenSet([
        review.email,
        review.authorEmail,
        review.userEmail,
    ]);

    if (uidTokens.size > 0 && Array.from(reviewUidTokens).some((token) => uidTokens.has(token))) {
        return true;
    }
    if (emailTokens.size > 0 && Array.from(reviewEmailTokens).some((token) => emailTokens.has(token))) {
        return true;
    }
    if (nameTokens.size > 0 && Array.from(reviewNameTokens).some((token) => nameTokens.has(token))) {
        return true;
    }

    return false;
}

export function summarizeReviewsForIdentity<T extends ReviewIdentityRecord>(
    reviews: T[],
    identity: ReviewOwnerIdentity
) {
    const matched = reviews.filter((review) => reviewMatchesIdentity(review, identity));
    const productIds = new Set<string>();
    let helpfulTotal = 0;

    matched.forEach((review) => {
        const productId =
            typeof review.productId === "string" && review.productId.trim()
                ? review.productId.trim()
                : "";
        if (productId) productIds.add(productId);

        if (typeof review.helpfulCount === "number" && Number.isFinite(review.helpfulCount)) {
            helpfulTotal += Math.max(0, review.helpfulCount);
        }
    });

    return {
        matched,
        reviewCount: matched.length,
        productCount: productIds.size,
        helpfulTotal,
    };
}
