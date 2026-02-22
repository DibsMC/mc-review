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

export default function AboutScreen() {
    return (
        <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 58 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Glass>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: "white" }}>
                        About
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                        What the app is building toward, how the community fits in, and what it is not.
                    </Text>

                    <H>What this app is</H>
                    <P>
                        This app helps people share honest, practical reviews of prescribed
                        flower products. It is built to make it easier to choose what might
                        suit you, based on real experiences.
                    </P>

                    <H>Where we are heading</H>
                    <P>
                        The plan is to make Review Budz the go-to community place to check
                        what tends to work best for what, using structured review data and
                        lived experience from members.
                    </P>

                    <H>How the community grows this</H>
                    <P>
                        Every useful review, vote, and feedback note helps improve the signal.
                        As the community grows, recommendations become clearer, comparisons
                        become fairer, and new members can make better choices faster.
                    </P>

                    <H>What this app is not</H>
                    <P>
                        It is not medical advice. It does not replace a clinician. Everyone
                        responds differently.
                    </P>

                    <H>Why reviews matter</H>
                    <P>
                        Names and percentages only tell part of the story. Reviews capture
                        things like clarity, mood, sleep, focus, and how manageable the side
                        effects were.
                    </P>

                    <H>What you can expect next</H>
                    <P>
                        We are building better profile depth, stronger moderation tools,
                        smarter summaries, and clearer guidance so this stays useful, trusted,
                        and practical for the whole community.
                    </P>
                </Glass>
            </ScrollView>
        </SafeAreaView>
    );
}
