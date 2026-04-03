import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BrandedScreenBackground from "../../../components/BrandedScreenBackground";
import { theme } from "../../../lib/theme";

const userBg = require("../../../assets/images/user-bg.png");

type TerpeneCardData = {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
    background: string;
    border: string;
    foundIn: string;
    vibe: string;
    line: string;
    bestFor: string[];
};

const QUICK_PICKS = [
    {
        title: "Pain / inflammation",
        pair: "Caryophyllene, Humulene",
        terpenes: ["Caryophyllene", "Humulene"],
        accent: "rgba(229,124,89,0.94)",
        background: "rgba(84,35,24,0.38)",
    },
    {
        title: "Sleep / heavy chill",
        pair: "Myrcene, Linalool",
        terpenes: ["Myrcene", "Linalool"],
        accent: "rgba(136,160,255,0.96)",
        background: "rgba(28,36,74,0.40)",
    },
    {
        title: "Anxiety / stress",
        pair: "Limonene, Linalool",
        terpenes: ["Limonene", "Linalool"],
        accent: "rgba(244,205,96,0.96)",
        background: "rgba(82,64,20,0.40)",
    },
    {
        title: "Daytime / clear head",
        pair: "Pinene, Limonene",
        terpenes: ["Pinene", "Limonene"],
        accent: "rgba(144,223,146,0.96)",
        background: "rgba(22,61,34,0.38)",
    },
];

const TERPENES: TerpeneCardData[] = [
    {
        name: "Caryophyllene",
        icon: "flame",
        accent: "rgba(237,134,100,0.96)",
        background: "rgba(89,37,26,0.42)",
        border: "rgba(237,134,100,0.30)",
        foundIn: "pepper, cloves",
        vibe: "Body-forward, grounding",
        line: "Often the first terpene people look for when body relief matters most.",
        bestFor: ["Pain", "Inflammation", "Body relief"],
    },
    {
        name: "Myrcene",
        icon: "moon",
        accent: "rgba(133,164,255,0.96)",
        background: "rgba(27,35,74,0.42)",
        border: "rgba(133,164,255,0.30)",
        foundIn: "mango, hops",
        vibe: "Heavy, calm, evening-leaning",
        line: "Usually the one that pushes a flower toward deeper relaxation and a heavier body feel.",
        bestFor: ["Sleep", "Wind-down", "Heavy chill"],
    },
    {
        name: "Limonene",
        icon: "sunny",
        accent: "rgba(245,204,91,0.96)",
        background: "rgba(88,68,18,0.42)",
        border: "rgba(245,204,91,0.30)",
        foundIn: "citrus peel",
        vibe: "Bright, lighter, lifted",
        line: "Often linked with a more upbeat or less edgy feel when THC would otherwise feel too sharp.",
        bestFor: ["Stress", "Mood", "Clearer lift"],
    },
    {
        name: "Linalool",
        icon: "flower",
        accent: "rgba(201,140,238,0.96)",
        background: "rgba(69,35,89,0.42)",
        border: "rgba(201,140,238,0.30)",
        foundIn: "lavender",
        vibe: "Quiet, calm, bedtime-friendly",
        line: "A softer calming terpene that often works especially well alongside myrcene.",
        bestFor: ["Calm", "Sleep", "Anxiety"],
    },
    {
        name: "Pinene",
        icon: "leaf",
        accent: "rgba(128,220,146,0.96)",
        background: "rgba(20,67,36,0.42)",
        border: "rgba(128,220,146,0.30)",
        foundIn: "pine, rosemary",
        vibe: "Fresh, alert, less foggy",
        line: "Usually a useful sign when you want something more daytime-friendly or mentally cleaner.",
        bestFor: ["Focus", "Daytime", "Clear head"],
    },
    {
        name: "Humulene",
        icon: "nutrition",
        accent: "rgba(204,184,112,0.96)",
        background: "rgba(73,58,20,0.42)",
        border: "rgba(204,184,112,0.30)",
        foundIn: "hops",
        vibe: "Subtle, body-supporting",
        line: "Often shows up as a supporting terpene beside caryophyllene when body relief is the goal.",
        bestFor: ["Inflammation", "Body relief", "Support terpene"],
    },
];

const MIXES = [
    "Myrcene + Linalool tends to lean sleepy, heavier, and more end-of-day.",
    "Caryophyllene + Humulene often leans more body-focused and relief-led.",
    "Limonene + Pinene usually points to a lighter, clearer daytime vibe.",
    "Terpenes do not work alone. THC, CBD, dose, and your own body still matter.",
];

function Glass({ children }: { children: ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: "rgba(11,15,22,0.78)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                borderRadius: 20,
                padding: 16,
            }}
        >
            {children}
        </View>
    );
}

function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 18,
                fontWeight: "800",
                color: "white",
                marginBottom: 10,
                marginTop: 4,
            }}
        >
            {children}
        </Text>
    );
}

function Body({ children }: { children: ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 14,
                lineHeight: 21,
                color: "rgba(255,255,255,0.84)",
            }}
        >
            {children}
        </Text>
    );
}

function QuickPickCard({
    title,
    pair,
    terpenes,
    accent,
    background,
    onPress,
}: {
    title: string;
    pair: string;
    terpenes: string[];
    accent: string;
    background: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                borderRadius: 16,
                borderWidth: 1,
                borderColor: accent.replace("0.96", "0.26").replace("0.94", "0.26"),
                backgroundColor: background,
                padding: 14,
                marginBottom: 10,
                opacity: pressed ? 0.86 : 1,
            })}
        >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>{title}</Text>
                    <Text style={{ color: accent, fontWeight: "900", marginTop: 6, fontSize: 13 }}>{pair}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.88)" />
            </View>
            <Text style={{ color: "rgba(255,255,255,0.68)", marginTop: 8, lineHeight: 18 }}>
                Open reviews filtered to {terpenes.join(" + ")}.
            </Text>
        </Pressable>
    );
}

function BestForPill({ label, color }: { label: string; color: string }) {
    return (
        <View
            style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: color.replace("0.96", "0.28"),
                backgroundColor: color.replace("0.96", "0.14"),
                paddingVertical: 7,
                paddingHorizontal: 10,
            }}
        >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>{label}</Text>
        </View>
    );
}

function TerpeneCard({ terpene }: { terpene: TerpeneCardData }) {
    return (
        <View
            style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: terpene.border,
                backgroundColor: terpene.background,
                padding: 14,
                marginBottom: 12,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: terpene.accent.replace("0.96", "0.18"),
                        borderWidth: 1,
                        borderColor: terpene.border,
                    }}
                >
                    <Ionicons name={terpene.icon} size={18} color={terpene.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{terpene.name}</Text>
                    <Text style={{ color: terpene.accent, fontWeight: "800", marginTop: 3, fontSize: 12 }}>
                        {terpene.vibe}
                    </Text>
                </View>
            </View>

            <Text
                style={{
                    color: "rgba(255,255,255,0.66)",
                    marginTop: 10,
                    fontSize: 12,
                    fontWeight: "700",
                }}
            >
                Found in: {terpene.foundIn}
            </Text>

            <Text
                style={{
                    color: "rgba(255,255,255,0.84)",
                    marginTop: 10,
                    fontSize: 14,
                    lineHeight: 20,
                }}
            >
                {terpene.line}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {terpene.bestFor.map((item) => (
                    <BestForPill key={item} label={item} color={terpene.accent} />
                ))}
            </View>
        </View>
    );
}

export default function TerpenesInfoScreen() {
    const router = useRouter();
    const openTerpenePreset = (title: string, terpenes: string[]) => {
        router.push({
            pathname: "/(tabs)/reviews",
            params: {
                terpenePreset: terpenes.join("|"),
                terpenePresetLabel: title,
                terpenePresetStamp: String(Date.now()),
            },
        });
    };

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
            <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10, backgroundColor: "transparent" }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 14,
                            gap: 12,
                        }}
                    >
                        <Pressable
                            onPress={() => router.back()}
                            style={({ pressed }) => ({
                                width: 42,
                                height: 42,
                                borderRadius: 999,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.14)",
                                backgroundColor: pressed ? "rgba(255,255,255,0.12)" : "rgba(11,15,22,0.68)",
                            })}
                        >
                            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.94)" />
                        </Pressable>

                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>Terpenes made simple</Text>
                            <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 3, lineHeight: 18 }}>
                                A plain-English guide to what the main terpene profiles usually lean towards.
                            </Text>
                        </View>
                    </View>

                    <Glass>
                        <Text style={{ color: "rgba(255,255,255,0.82)", marginTop: 8, lineHeight: 22 }}>
                            Terpenes shape a flower&apos;s smell and can influence the overall vibe. They are useful
                            clues, not guarantees.
                        </Text>
                        <Text style={{ color: theme.colors.textOnDarkSecondary, marginTop: 10, lineHeight: 20 }}>
                            The best way to use them is as a quick guide, then compare that with your own reviews,
                            your symptoms, and how different flowers actually feel for you.
                        </Text>
                    </Glass>

                    <View style={{ marginTop: 16 }}>
                        <Glass>
                            <SectionTitle>Quick picks</SectionTitle>
                            <Body>
                                If you just want the fast version, start here. These pairings are the quickest way
                                to scan a strain and decide whether it looks more daytime, more body-led, or more
                                bedtime-friendly.
                            </Body>
                            <View style={{ marginTop: 14 }}>
                                {QUICK_PICKS.map((item) => (
                                    <QuickPickCard
                                        key={item.title}
                                        title={item.title}
                                        pair={item.pair}
                                        terpenes={item.terpenes}
                                        accent={item.accent}
                                        background={item.background}
                                        onPress={() => openTerpenePreset(item.title, item.terpenes)}
                                    />
                                ))}
                            </View>
                        </Glass>
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <Glass>
                            <SectionTitle>What major and minor mean</SectionTitle>
                            <Body>
                                When a flower shows a terpene as <Text style={{ color: "white", fontWeight: "900" }}>major</Text>, it just means that terpene is one of the stronger voices in the mix.
                                <Text style={{ color: "white", fontWeight: "900" }}> Minor</Text> means it is still present, but in a smaller amount.
                            </Body>
                            <Text
                                style={{
                                    marginTop: 12,
                                    color: theme.colors.textOnDarkSecondary,
                                    lineHeight: 20,
                                }}
                            >
                                Major does not automatically mean better, and minor does not mean irrelevant. A small terpene can still shape the overall feel when it combines with the others.
                            </Text>
                        </Glass>
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <Glass>
                            <SectionTitle>The main terpenes</SectionTitle>
                            <Body>
                                Most flowers are a mix. These are the six main ones worth learning first because
                                they show up often and give you a good starting feel for what a strain may lean
                                towards.
                            </Body>
                            <View style={{ marginTop: 14 }}>
                                {TERPENES.map((terpene) => (
                                    <TerpeneCard key={terpene.name} terpene={terpene} />
                                ))}
                            </View>
                        </Glass>
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <Glass>
                            <SectionTitle>How mixes usually feel</SectionTitle>
                            <View style={{ marginTop: 6 }}>
                                {MIXES.map((line) => (
                                    <View
                                        key={line}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "flex-start",
                                            marginBottom: 12,
                                        }}
                                    >
                                        <Ionicons
                                            name="ellipse"
                                            size={8}
                                            color="rgba(245,212,126,0.86)"
                                            style={{ marginTop: 7, marginRight: 10 }}
                                        />
                                        <Text style={{ flex: 1, color: "rgba(255,255,255,0.84)", lineHeight: 21 }}>
                                            {line}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </Glass>
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <Glass>
                            <SectionTitle>Real talk</SectionTitle>
                            <Body>
                                Terpenes help, but they are not the whole story. THC, CBD, dose, your tolerance,
                                and your own body can all change how a flower lands.
                            </Body>
                            <Text
                                style={{
                                    marginTop: 12,
                                    color: "white",
                                    fontWeight: "900",
                                    fontSize: 15,
                                    lineHeight: 24,
                                }}
                            >
                                Simple rule: body relief often starts with caryophyllene, sleep usually leans
                                myrcene plus linalool, and daytime clarity often leans pinene plus limonene.
                            </Text>
                        </Glass>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </BrandedScreenBackground>
    );
}
