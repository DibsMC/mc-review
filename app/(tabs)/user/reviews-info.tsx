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

export default function ReviewsInfoScreen() {
    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Glass>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>
                        Reviews and scoring
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                        A quick guide to keeping reviews consistent and useful.
                    </Text>

                    <H>How scoring works</H>
                    <P>
                        Reviews are designed to be quick, consistent, and genuinely useful.
                        Each score is a simple 1 to 5 scale.
                    </P>

                    <H>What 1 to 5 means</H>
                    <P>
                        1 means not good for that category. 3 means average or mixed. 5 means
                        excellent.
                    </P>

                    <H>Examples</H>
                    <P>Daytime suitability: 1 = not suitable, 5 = ideal.</P>
                    <P>Mental clarity: 1 = foggy, 5 = clear headed.</P>

                    <H>Tips for a great review</H>
                    <P>
                        Mention what you used it for, how fast it kicked in, how long it
                        lasted, and anything you would warn a friend about.
                    </P>


                    <H>Community makes this useful</H>
                    <P>
                        Every review helps other people make a more informed decision. If you add notes and photos,
                        it improves the overall picture of what each product feels like in the real world.
                    </P>
                    <P>
                        The more people contribute, the more accurate the badges and recommendations become over time.
                    </P>


                    <H>Trust and safety</H>
                    <P>
                        This app is for sharing personal experiences, not medical advice. If
                        something feels wrong, speak to a clinician.
                    </P>
                </Glass>
            </ScrollView>
        </SafeAreaView>
    );
}
