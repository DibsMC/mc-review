import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getFirebaseAuth, getFirebaseFirestore } from "../../../lib/nativeDeps";

function Glass({ children }: { children: React.ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.16)",
                borderWidth: 1,
                borderRadius: 18,
                padding: 16,
            }}
        >
            {children}
        </View>
    );
}

function H({ children }: { children: React.ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 18,
                fontWeight: "900",
                color: "white",
                marginBottom: 8,
                marginTop: 10,
            }}
        >
            {children}
        </Text>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 14,
                lineHeight: 20,
                color: "rgba(255,255,255,0.80)",
                marginBottom: 8,
            }}
        >
            {children}
        </Text>
    );
}

const REVIEW_GUIDE_VERSION = 1;

export default function ReviewsInfoScreen() {
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();
    const insets = useSafeAreaInsets();

    const [accepted, setAccepted] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const uid = auth?.().currentUser?.uid;
        if (!uid || !firestore) {
            setAccepted(false);
            return;
        }

        const unsub = firestore()
            .collection("users")
            .doc(uid)
            .onSnapshot(
                (doc) => {
                    const data = (doc.data() as any) ?? {};
                    setAccepted(
                        !!data?.reviewGuideAcceptedAtMs ||
                        (typeof data?.reviewGuideAcceptedVersion === "number" &&
                            data.reviewGuideAcceptedVersion >= REVIEW_GUIDE_VERSION)
                    );
                },
                () => setAccepted(false)
            );

        return () => unsub();
    }, [auth, firestore]);

    const markAsRead = async () => {
        const uid = auth?.().currentUser?.uid;
        if (!uid || !firestore || saving) return;
        setSaving(true);
        try {
            await firestore()
                .collection("users")
                .doc(uid)
                .set(
                    {
                        reviewGuideAcceptedAtMs: Date.now(),
                        reviewGuideAcceptedVersion: REVIEW_GUIDE_VERSION,
                        updatedAt: firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
            setAccepted(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} edges={["top", "bottom"]}>
            <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 16 }}>
                <Glass>
                    <Text style={{ fontSize: 24, fontWeight: "900", color: "white" }}>
                        Review writing guide
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                        Keep ratings useful, consistent, and fair for everyone.
                    </Text>

                    <H>What your overall rating means</H>
                    <P>
                        Give one honest overall score (1 to 5) based on quality, consistency, flavour, appearance, dryness, and whether you'd choose it again.
                    </P>

                    <H>How to use effect ratings</H>
                    <P>
                        Only rate effects this flower actually helped with. Leave all unrelated effects blank.
                    </P>
                    <P>
                        Don’t force every box. Sparse, accurate data is better than guessing.
                    </P>

                    <H>Consistency rules (important)</H>
                    <P>
                        Avoid contradictory ratings. Example: if couch lock is very high, daytime suitability should not also be high.
                    </P>
                    <P>
                        If a strain causes headaches for you, mention that clearly in notes so others can interpret your scores.
                    </P>

                    <H>Quick effect guide</H>
                    <P>
                        Daytime suitability: staying functional for daily tasks and social activity.
                    </P>
                    <P>
                        Couch lock / sleepiness: heavy sedation, unwind, evening use.
                    </P>
                    <P>
                        Calm and anxiety relief: less racing thoughts/paranoia, more emotional grounding.
                    </P>
                    <P>
                        Uplifting / focus / creativity: motivation, mental energy, and task follow-through.
                    </P>
                    <P>
                        Munchies: stronger appetite drive after use.
                    </P>

                    <H>Important notes</H>
                    <P>
                        Save tags (Favourite, Daytime, Afternoon, Night) are personal organisation tags and not public medical claims.
                    </P>
                    <P>
                        Terpenes only affect terpene filtering when terpene data exists for that product.
                    </P>
                    <P>
                        This app shares experience data, not medical advice.
                    </P>

                    <Pressable
                        onPress={markAsRead}
                        disabled={accepted || saving}
                        style={({ pressed }) => ({
                            marginTop: 14,
                            borderRadius: 14,
                            paddingVertical: 13,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: accepted ? "rgba(138,231,168,0.20)" : "rgba(52,156,88,0.95)",
                            borderWidth: 1,
                            borderColor: accepted ? "rgba(138,231,168,0.55)" : "rgba(138,231,168,0.35)",
                            opacity: accepted || saving ? 0.88 : pressed ? 0.9 : 1,
                        })}
                    >
                        <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>
                            {accepted ? "Guide marked as read" : saving ? "Saving..." : "I have read and understood this"}
                        </Text>
                    </Pressable>
                </Glass>
            </ScrollView>
        </SafeAreaView>
    );
}
