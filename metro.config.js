const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase uses package.json "exports" for subpath imports.
// This makes Metro understand imports like "firebase/auth/react-native".
config.resolver.unstable_enablePackageExports = true;

// Some setups also need this line to avoid resolution edge cases
config.resolver.unstable_conditionNames = ["react-native", "browser", "require"];

module.exports = config;
