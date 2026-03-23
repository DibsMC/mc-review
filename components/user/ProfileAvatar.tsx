import React, { useMemo } from "react";
import { Image, Text, View } from "react-native";
import { AVATARS } from "../../lib/avatarOptions";

const budImg = require("../../assets/icons/bud.png");

export default function ProfileAvatar({
  avatarId,
  photoURL,
  size = 56,
}: {
  avatarId: string | null;
  photoURL?: string | null;
  size?: number;
}) {
  const picked = useMemo(() => AVATARS.find((avatar) => avatar.id === avatarId) ?? null, [avatarId]);
  const presetAvatarZoom = picked?.image && !photoURL ? 1.14 : photoURL ? 1.06 : 1;
  const imageStyle = {
    width: Math.round(size * presetAvatarZoom),
    height: Math.round(size * presetAvatarZoom),
  } as const;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={imageStyle} resizeMode="cover" />
      ) : picked ? (
        picked.image ? (
          <Image source={picked.image} resizeMode="cover" style={imageStyle} />
        ) : (
          <Text style={{ fontSize: Math.round(size * 0.52) }}>{picked.emoji}</Text>
        )
      ) : (
        <Image
          source={budImg}
          resizeMode="contain"
          style={{
            width: Math.round(size * 0.52),
            height: Math.round(size * 0.52),
          }}
        />
      )}
    </View>
  );
}
