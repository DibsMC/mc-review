import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View } from "react-native";

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

function P({ children }: { children: React.ReactNode }) {
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
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Glass>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>
                        Terms and legal
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                        The important bits, written in plain English.
                    </Text>

                    <H>Terms</H>
                    <P>
                        By using this app, you agree that you are responsible for what you
                        post, and that reviews are personal experiences.
                    </P>

                    <H>Community behaviour</H>
                    <P>
                        Treat other members respectfully. Harassment, hate speech, bullying,
                        threats, or repeated hostility are not allowed.
                    </P>

                    <H>Content standards</H>
                    <P>
                        Reviews should be honest, relevant, and based on real experience.
                        Derogatory, abusive, or deliberately misleading content may be removed.
                    </P>

                    <H>Moderation and enforcement</H>
                    <P>
                        We may remove reviews or limit account access when content breaks these
                        standards. Repeat offenders may be removed from the community.
                    </P>

                    <H>Medical disclaimer</H>
                    <P>
                        Content in this app is informational only and is not medical advice.
                        Always follow professional guidance.
                    </P>

                    <H>Privacy</H>
                    <P>
                        Your account information is used to support sign in and basic
                        profile features. We do not sell personal data.
                    </P>

                    <H>Legal</H>
                    <P>
                        This app is not affiliated with clinics, pharmacies, or producers
                        unless explicitly stated.
                    </P>

                    <H>Acknowledgements</H>
                    <P>
                        If we use product data sourced from third parties later, we will
                        list sources and licensing details here.
                    </P>
                </Glass>
            </ScrollView>
        </SafeAreaView>
    );
}
