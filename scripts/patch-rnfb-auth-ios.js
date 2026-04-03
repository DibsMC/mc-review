const fs = require("fs");
const path = require("path");

const modulePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native-firebase",
  "auth",
  "ios",
  "RNFBAuth",
  "RNFBAuthModule.m"
);

function main() {
  if (!fs.existsSync(modulePath)) {
    console.warn("[patch-rnfb-auth-ios] RNFBAuthModule.m not found, skipping");
    return;
  }

  const source = fs.readFileSync(modulePath, "utf8");

  if (source.includes("rnfb_patched_firebaseUserToDict_v1")) {
    console.log("[patch-rnfb-auth-ios] already patched");
    return;
  }

  const methodRegex = /- \(NSDictionary \*\)firebaseUserToDict:\(FIRUser \*\)user \{[\s\S]*?#if TARGET_OS_IOS[\s\S]*?\n\s*\};\n\}/m;

  const replacement = `- (NSDictionary *)firebaseUserToDict:(FIRUser *)user {\n  // rnfb_patched_firebaseUserToDict_v1\n  id (^safeString)(NSString *) = ^id(NSString *value) {\n    return value ? [value copy] : [NSNull null];\n  };\n  id (^safeURLString)(NSURL *) = ^id(NSURL *value) {\n    return value ? [[value absoluteString] copy] : [NSNull null];\n  };\n\n  NSMutableDictionary *result = [NSMutableDictionary dictionary];\n  result[keyDisplayName] = safeString(user.displayName);\n  result[keyEmail] = safeString(user.email);\n  result[@\"emailVerified\"] = @(user.emailVerified);\n  result[@\"isAnonymous\"] = @(user.anonymous);\n  result[@\"metadata\"] = @{\n    @\"creationTime\" : user.metadata.creationDate\n        ? (id) @(round([user.metadata.creationDate timeIntervalSince1970] * 1000.0))\n        : [NSNull null],\n    @\"lastSignInTime\" : user.metadata.lastSignInDate\n        ? (id) @(round([user.metadata.lastSignInDate timeIntervalSince1970] * 1000.0))\n        : [NSNull null],\n  };\n  result[keyPhoneNumber] = safeString(user.phoneNumber);\n  result[keyPhotoUrl] = safeURLString(user.photoURL);\n\n  NSArray *providerData = @[];\n  @try {\n    providerData = [self convertProviderData:user.providerData] ?: @[];\n  } @catch (__unused NSException *exception) {\n    providerData = @[];\n  }\n  result[@\"providerData\"] = providerData;\n\n  NSString *providerId = nil;\n  @try {\n    providerId = user.providerID ? [[user.providerID lowercaseString] copy] : nil;\n  } @catch (__unused NSException *exception) {\n    providerId = nil;\n  }\n  result[keyProviderId] = providerId ?: [NSNull null];\n\n  id refreshToken = [NSNull null];\n  @try {\n    NSString *token = user.refreshToken;\n    refreshToken = token ? [token copy] : [NSNull null];\n  } @catch (__unused NSException *exception) {\n    refreshToken = [NSNull null];\n  }\n  result[@\"refreshToken\"] = refreshToken;\n  result[@\"tenantId\"] = safeString(user.tenantID);\n  result[keyUid] = safeString(user.uid);\n#if TARGET_OS_IOS\n  NSArray *enrolledFactors = @[];\n  @try {\n    enrolledFactors = [self convertMultiFactorData:user.multiFactor.enrolledFactors] ?: @[];\n  } @catch (__unused NSException *exception) {\n    enrolledFactors = @[];\n  }\n  result[@\"multiFactor\"] = @{ @\"enrolledFactors\" : enrolledFactors };\n#endif\n  return result;\n}`;

  if (!methodRegex.test(source)) {
    throw new Error("[patch-rnfb-auth-ios] Could not find firebaseUserToDict method to patch");
  }

  const patched = source.replace(methodRegex, replacement);
  fs.writeFileSync(modulePath, patched);
  console.log("[patch-rnfb-auth-ios] applied");
}

main();
