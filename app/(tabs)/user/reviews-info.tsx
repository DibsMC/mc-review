import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View } from "react-native";
import BrandedScreenBackground from "../../../components/BrandedScreenBackground";

const userBg = require("../../../assets/images/user-bg.png");

function Glass({ children }: { children: ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: "rgba(11,15,22,0.78)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                borderRadius: 18,
                padding: 16,
            }}
        >
            {children}
        </View>
    );
}

function H({ children }: { children: ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 18,
                fontWeight: "800",
                color: "white",
                marginBottom: 8,
                marginTop: 10,
                lineHeight: 24,
            }}
        >
            {children}
        </Text>
    );
}

function P({ children }: { children: ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 14,
                lineHeight: 22,
                color: "rgba(255,255,255,0.84)",
                marginBottom: 10,
            }}
        >
            {children}
        </Text>
    );
}

export default function ReviewsInfoScreen() {
    return (
        <BrandedScreenBackground
            source={userBg}
            gradientColors={[
                "rgba(20,12,6,0.16)",
                "rgba(9,12,18,0.52)",
                "rgba(6,8,12,0.94)",
            ]}
            scrimColor="rgba(5,7,11,0.24)"
        >
            <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58, backgroundColor: "transparent" }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                    <Glass>
                        <Text style={{ fontSize: 21, lineHeight: 27, fontWeight: "800", color: "white" }}>
                            Reviews and scoring
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.82)", marginTop: 6, lineHeight: 21 }}>
                            A quick guide to how the score works and what makes a review genuinely helpful.
                        </Text>

                        <H>How the main score works</H>
                        <P>
                            The headline bud score is a simple 1 to 5 scale. It leans mostly on your overall
                            rating, then blends in the effect sliders so a flower with more nuance can land at
                            a fairer score like 3.5 or 3.8 instead of always looking flat.
                        </P>

                        <H>What 1 to 5 means</H>
                        <P>
                            1 means poor or not useful for that category. 3 means mixed, average, or situational.
                            5 means it really delivered for what you were judging.
                        </P>

                        <H>What the sliders mean</H>
                        <P>Daytime fit: 1 = too heavy to stay functional, 5 = easy to stay clear and productive.</P>
                        <P>Sleep support: 1 = no sleepy pull, 5 = strongly bed-leaning or knockout.</P>
                        <P>Calm: 1 = barely settled anything, 5 = noticeably soothed and steadied you.</P>
                        <P>Clear head: 1 = foggy or scattered, 5 = mentally cleaner and easier to think with.</P>
                        <P>Pain relief: 1 = little benefit, 5 = strong relief for the issue you were targeting.</P>

                        <H>What makes a review useful</H>
                        <P>
                            The best reviews say what you used it for, whether it suited daytime or evening use,
                            how quickly it kicked in, and whether you would order it again. If pain relief mattered,
                            mention what kind. If you vaped it, temperature notes are genuinely useful too.
                        </P>

                        <H>A strong quick format</H>
                        <P>
                            Try this: what you noticed first, what it was best for, how long it lasted, any downside,
                            and whether it earned a repeat order. That is usually enough to help the next person.
                        </P>

                        <H>Why your reviews matter</H>
                        <P>
                            Your reviews help other members make informed choices. Community ratings only get better
                            when people share honest, specific experiences that others can actually learn from.
                        </P>
                        <P>
                            Every proper review improves the accuracy of search, community summaries, and recommendations
                            over time, especially for sleep, focus, calmer evenings, pain relief, and repeat-order confidence.
                        </P>

                        <H>Why detail matters</H>
                        <P>
                            Search, smart badges, and community summaries all improve when reviews include real detail.
                            Good notes help other members spot strains for sleep, focus, pain, calmer evenings, and more.
                        </P>

                        <H>Trust and safety</H>
                        <P>
                            Reviews are personal experiences, not medical advice. If something feels off for you,
                            stop and speak to a clinician.
                        </P>
                    </Glass>
                </ScrollView>
            </SafeAreaView>
        </BrandedScreenBackground>
    );
}
