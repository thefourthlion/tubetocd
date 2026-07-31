#!/usr/bin/env node
/**
 * Writes android/local.properties with sdk.dir so Gradle can find the Android SDK.
 * Uses ANDROID_HOME if set; otherwise common defaults (e.g. ~/Library/Android/sdk on Mac).
 * Run from client directory: node scripts/cap-android-setup.js
 */

const fs = require("fs");
const path = require("path");

const clientRoot = path.resolve(__dirname, "..");
const androidDir = path.join(clientRoot, "android");
const localPropsPath = path.join(androidDir, "local.properties");

function getDefaultSdkPath() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (!home) return null;
  switch (process.platform) {
    case "darwin":
    case "linux":
      return path.join(home, "Library", "Android", "sdk");
    case "win32":
      return path.join(process.env.LOCALAPPDATA || home, "Android", "Sdk");
    default:
      return path.join(home, "Android", "Sdk");
  }
}

const sdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || getDefaultSdkPath();

if (!sdkPath) {
  console.error("[cap-android-setup] Could not determine Android SDK path.");
  console.error("Set ANDROID_HOME (or ANDROID_SDK_ROOT) to your SDK location.");
  process.exit(1);
}

const platformTools = path.join(sdkPath, "platform-tools");
if (!fs.existsSync(platformTools)) {
  console.error("[cap-android-setup] Android SDK not found at:", sdkPath);
  console.error("Install Android Studio or the command-line tools, or set ANDROID_HOME.");
  process.exit(1);
}

if (!fs.existsSync(androidDir)) {
  console.error("[cap-android-setup] android/ not found. Run: npx cap add android");
  process.exit(1);
}

// Gradle local.properties: backslashes must be escaped on Windows
const sdkDirValue = sdkPath.replace(/\\/g, "\\\\");
fs.writeFileSync(localPropsPath, `sdk.dir=${sdkDirValue}\n`, "utf8");
console.log("[cap-android-setup] Wrote android/local.properties with sdk.dir=", sdkPath);
