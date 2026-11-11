#!/usr/bin/env bash
# Archives the iOS app, signed by the owner's Apple account, and uploads it to TestFlight. Run on the owner's Mac with
# Xcode signed in to the Realms organization's account (Xcode > Settings > Accounts): pnpm --dir apps/ios upload:testflight
# Signing stays on that Mac: deployment credentials never enter GitHub (.github/scripts/workflow-credentials.test.ts).
set -euo pipefail

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
# The Team ID is read from the file the site serves, so the app and its universal links name the same team.
ASSOCIATION="$APP_DIR/../game/public/.well-known/apple-app-site-association"
TEAM_ID=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).applinks.details[0].appIDs[0]?.split(".")[0] ?? ""' "$ASSOCIATION")
if [ -z "$TEAM_ID" ]; then
  echo "No Team ID in $ASSOCIATION yet: add the app there first (apps/ios/README.md)." >&2
  exit 1
fi
# TestFlight refuses a build number it has seen for the same version: the build's time never repeats.
BUILD_NUMBER=$(date -u +%Y%m%d%H%M)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$APP_DIR"
pnpm exec cap sync ios
xcodebuild archive \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath "$WORK/Realms.xcarchive" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
cat >"$WORK/export-options.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>upload</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>$TEAM_ID</string>
</dict>
</plist>
PLIST
xcodebuild -exportArchive \
  -archivePath "$WORK/Realms.xcarchive" \
  -exportOptionsPlist "$WORK/export-options.plist" \
  -exportPath "$WORK/export" \
  -allowProvisioningUpdates
echo "Uploaded build $BUILD_NUMBER. TestFlight lists it once App Store Connect has processed it."
