import { ImageSourcePropType } from "react-native";

export type AvatarOption = {
    id: string;
    label: string;
    emoji?: string;
    image?: ImageSourcePropType;
};

const EMOJI_AVATARS: AvatarOption[] = [
    { id: "leaf", emoji: "🍃", label: "Leaf" },
    { id: "herb", emoji: "🌿", label: "Herb" },
    { id: "cloud", emoji: "💨", label: "Cloud" },
    { id: "fire", emoji: "🔥", label: "Fire" },
    { id: "moon", emoji: "🌙", label: "Moon" },
    { id: "alien", emoji: "👽", label: "Alien" },
    { id: "ufo", emoji: "🛸", label: "UFO" },
    { id: "planet", emoji: "🪐", label: "Planet" },
    { id: "glasses", emoji: "🕶️", label: "Shades" },
    { id: "headphones", emoji: "🎧", label: "Headphones" },
    { id: "brain", emoji: "🧠", label: "Brain" },
    { id: "zen", emoji: "🧘", label: "Zen" },
    { id: "honey", emoji: "🍯", label: "Honey" },
    { id: "beaker", emoji: "🧪", label: "Beaker" },
    { id: "melting", emoji: "🫠", label: "Melting" },
    { id: "dizzy", emoji: "😵‍💫", label: "Dizzy" },
    { id: "exhale", emoji: "😮‍💨", label: "Exhale" },
    { id: "sparkles", emoji: "✨", label: "Sparkles" },
    { id: "donut", emoji: "🍩", label: "Donut" },
    { id: "juice", emoji: "🧃", label: "Juice" },
];

const BAKED_AVATARS: AvatarOption[] = [
    {
        id: "baked-chilled-cheetah",
        label: "Baked Chilled Cheetah",
        image: require("../assets/avatars/baked-animals/baked-chilled-cheeta.png"),
    },
    {
        id: "baked-contemplative-frog",
        label: "Baked Contemplative Frog",
        image: require("../assets/avatars/baked-animals/baked-contemplative-frog.png"),
    },
    {
        id: "baked-corporate-sloth",
        label: "Baked Corporate Sloth",
        image: require("../assets/avatars/baked-animals/baked-corporate-sloth.png"),
    },
    {
        id: "baked-cunning-fox",
        label: "Baked Cunning Fox",
        image: require("../assets/avatars/baked-animals/baked-cunning-fox.png"),
    },
    {
        id: "baked-dino",
        label: "Baked Dino",
        image: require("../assets/avatars/baked-animals/baked-dino.png"),
    },
    {
        id: "baked-dj-meerkat",
        label: "Baked DJ Meerkat",
        image: require("../assets/avatars/baked-animals/baked-dj-meerkat.png"),
    },
    {
        id: "baked-ginger-cat",
        label: "Baked Ginger Cat",
        image: require("../assets/avatars/baked-animals/baked-ginger-cat.png"),
    },
    {
        id: "baked-goat",
        label: "Baked Goat",
        image: require("../assets/avatars/baked-animals/baked-goat.png"),
    },
    {
        id: "baked-gorilla",
        label: "Baked Gorilla",
        image: require("../assets/avatars/baked-animals/baked-gorrilla.png"),
    },
    {
        id: "baked-grumpy-badger",
        label: "Baked Grumpy Badger",
        image: require("../assets/avatars/baked-animals/baked-grumpy-badger.png"),
    },
    {
        id: "baked-kangaroo",
        label: "Baked Kangaroo",
        image: require("../assets/avatars/baked-animals/baked-kangaroo.png"),
    },
    {
        id: "baked-lion",
        label: "Baked Lion",
        image: require("../assets/avatars/baked-animals/baked-lion.png"),
    },
    {
        id: "baked-lizard",
        label: "Baked Lizard",
        image: require("../assets/avatars/baked-animals/baked-lizard.png"),
    },
    {
        id: "baked-octopus",
        label: "Baked Octopus",
        image: require("../assets/avatars/baked-animals/baked-octopus.png"),
    },
    {
        id: "baked-overconfident-parrot",
        label: "Baked Overconfident Parrot",
        image: require("../assets/avatars/baked-animals/baked-over-confident-parot.png"),
    },
    {
        id: "baked-panda",
        label: "Baked Panda",
        image: require("../assets/avatars/baked-animals/baked-panda.png"),
    },
    {
        id: "baked-peppa",
        label: "Baked Peppa",
        image: require("../assets/avatars/baked-animals/baked-peppa.png"),
    },
    {
        id: "baked-pixie",
        label: "Baked Pixie",
        image: require("../assets/avatars/baked-animals/baked-pixie.png"),
    },
    {
        id: "baked-rabbit",
        label: "Baked Rabbit",
        image: require("../assets/avatars/baked-animals/baked-rabbit.png"),
    },
    {
        id: "baked-raccoon",
        label: "Baked Raccoon",
        image: require("../assets/avatars/baked-animals/baked-racoon.png"),
    },
    {
        id: "baked-rasta-dog",
        label: "Baked Rasta Dog",
        image: require("../assets/avatars/baked-animals/baked-rasta-dog.png"),
    },
    {
        id: "baked-rhino-soldier",
        label: "Baked Rhino Soldier",
        image: require("../assets/avatars/baked-animals/baked-rhino-soldier.png"),
    },
    {
        id: "baked-robot",
        label: "Baked Robot",
        image: require("../assets/avatars/baked-animals/baked-robot.png"),
    },
    {
        id: "baked-scorpion",
        label: "Baked Scorpion",
        image: require("../assets/avatars/baked-animals/baked-scorpion.png"),
    },
    {
        id: "baked-sloth",
        label: "Baked Sloth",
        image: require("../assets/avatars/baked-animals/baked-sloth.png"),
    },
    {
        id: "baked-sly-otter",
        label: "Baked Sly Otter",
        image: require("../assets/avatars/baked-animals/baked-sly-otter.png"),
    },
    {
        id: "baked-smug-pug",
        label: "Baked Smug Pug",
        image: require("../assets/avatars/baked-animals/baked-smug-pug.png"),
    },
    {
        id: "baked-zen-tortoise",
        label: "Baked Zen Tortoise",
        image: require("../assets/avatars/baked-animals/baked-zen-tortouise.png"),
    },
    {
        id: "cheeky-monkey",
        label: "Cheeky Monkey",
        image: require("../assets/avatars/baked-animals/cheeky-monkey.png"),
    },
    {
        id: "wise-old-owl",
        label: "Wise Old Owl",
        image: require("../assets/avatars/baked-animals/wise-old-owl.png"),
    },
];

export const AVATARS: AvatarOption[] = [...BAKED_AVATARS, ...EMOJI_AVATARS];
