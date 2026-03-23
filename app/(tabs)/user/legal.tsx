import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View } from "react-native";
import BrandedScreenBackground from "../../../components/BrandedScreenBackground";

const userBg = require("../../../assets/images/user-bg.png");

function Glass({ children }: { children: ReactNode }) {
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

function H({ children }: { children: ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 18,
                fontWeight: "800",
                color: "white",
                marginBottom: 8,
                marginTop: 10,
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
                lineHeight: 20,
                color: "rgba(255,255,255,0.78)",
                marginBottom: 10,
            }}
        >
            {children}
        </Text>
    );
}

export default function LegalScreen() {
    return (
        <BrandedScreenBackground
            source={userBg}
            gradientColors={["rgba(20,12,6,0.16)", "rgba(9,12,18,0.52)", "rgba(6,8,12,0.94)"]}
            scrimColor="rgba(5,7,11,0.24)"
        >
            <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58, backgroundColor: "transparent" }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                    <Glass>
                        <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>
                            Terms and legal
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6, lineHeight: 20 }}>
                            The important bits, written in plain English and refreshed for the current app.
                        </Text>

                        <H>Terms</H>
                        <P>
                            By using Review Budz, you agree that what you post is your responsibility and should reflect your genuine personal experience. Reviews, ratings, photos, and notes may be moderated if they break app rules or put other members at risk.
                        </P>

                        <H>Medical disclaimer</H>
                        <P>
                            Everything in the app is informational only. It is not medical advice, it does not replace clinician guidance, and it should not be treated as a promise of outcome for any product.
                        </P>

                        <H>Privacy and account data</H>
                        <P>
                            We use Firebase Authentication to sign you in and keep your account secure. We use Firestore to store account details, reviews, profile stats, moderation data, favourites, follows, and helpful/report actions.
                        </P>
                        <P>
                            We also use local device storage for lightweight app preferences such as recent visit data and UI state. We do not sell your personal data.
                        </P>

                        <H>Public content</H>
                        <P>
                            Reviews you publish, your display name, avatar choice, and public profile stats can be visible to other members inside the app. Private notes stay attached to your account only and are not shown publicly.
                        </P>

                        <H>Moderation and safety</H>
                        <P>
                            Reported reviews can be placed under review by admins. We may restrict posting, remove content, or lock accounts where needed to protect the community and keep the information trustworthy.
                        </P>

                        <H>Legal position</H>
                        <P>
                            Review Budz is an independent community app. Unless we explicitly say otherwise, we are not affiliated with clinics, pharmacies, brands, or producers.
                        </P>

                        <H>Acknowledgements</H>
                        <P>
                            Product information, community review data, analytics counts, and profile activity are used to improve search, scoring, and moderation inside the app. If any third-party data sources or licensed feeds are added later, we will list them here.
                        </P>
                    </Glass>
                </ScrollView>
            </SafeAreaView>
        </BrandedScreenBackground>
    );
}
