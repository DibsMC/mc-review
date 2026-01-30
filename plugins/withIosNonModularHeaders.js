const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withIosNonModularHeaders(config) {
    return withDangerousMod(config, [
        "ios",
        async (config) => {
            const podfilePath = path.join(
                config.modRequest.platformProjectRoot,
                "Podfile"
            );

            let podfile = fs.readFileSync(podfilePath, "utf8");

            const marker = "post_install do |installer|";

            const settingsBlock = `
  # --- Fix: allow non-modular headers (Firebase + RN frameworks) ---
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
      config.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    end
  end
  # --- end fix ---
`;

            if (podfile.includes(marker)) {
                if (!podfile.includes("Fix: allow non-modular headers")) {
                    podfile = podfile.replace(marker, `${marker}${settingsBlock}`);
                }
            } else {
                podfile += `

post_install do |installer|
${settingsBlock}
end
`;
            }

            fs.writeFileSync(podfilePath, podfile);
            return config;
        },
    ]);
};
