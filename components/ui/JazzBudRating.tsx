import React from "react";
import { Image, View } from "react-native";

const budImg = require("../../assets/icons/bud.png");

function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
}

export function JazzBudRating({
    value,
    size = 22,
}: {
    value: number;
    size?: number;
}) {
    const safe = Number.isFinite(value) ? clamp(value, 0, 5) : 0;

    // Muted, earthy plates (premium on dark UI, not “danger”)
    const plates = [
        "rgba(92, 74, 56, 0.52)", // warm umber
        "rgba(68, 86, 74, 0.52)", // moss
        "rgba(78, 72, 92, 0.52)", // muted plum
        "rgba(84, 88, 66, 0.52)", // olive
        "rgba(74, 82, 92, 0.52)", // slate
    ];

    const border = "rgba(255,255,255,0.10)";

    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => {
                const rawFill = Math.max(0, Math.min(1, safe - i));
                const fill = Math.round(rawFill * 4) / 4; // quarter fills
                const px = Math.round(size * fill);

                return (
                    <View
                        key={`jbud-${i}`}
                        style={{
                            width: size + 10,
                            height: size + 10,
                            marginRight: i === 4 ? 0 : 8,
                            borderRadius: 999,
                            backgroundColor: plates[i],
                            borderWidth: 1,
                            borderColor: border,
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                        }}
                    >
                        <Image
                            source={budImg}
                            resizeMode="contain"
                            style={{ width: size, height: size, opacity: 0.22 }}
                        />

                        {fill > 0 ? (
                            <View
                                style={{
                                    position: "absolute",
                                    left: 5,
                                    top: 5,
                                    width: px,
                                    height: size,
                                    overflow: "hidden",
                                }}
                            >
                                <Image
                                    source={budImg}
                                    resizeMode="contain"
                                    style={{ width: size, height: size, opacity: 1 }}
                                />
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}
