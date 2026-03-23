import { Redirect } from "expo-router";
import auth from "@react-native-firebase/auth";

export default function IndexScreen() {
    return <Redirect href={auth().currentUser ? "/(tabs)" : "/(tabs)/user"} />;
}
