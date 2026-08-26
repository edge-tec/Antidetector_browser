#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# AntiProfiles — macOS Apple Silicon Code Signing & Notarization Script
# Automates recursive deep signing, Hardened Runtime with entitlements,
# Apple Notary API submission, and ticket stapling for Gatekeeper compliance.
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

APP_PATH="dist/mac-arm64/AntiProfiles.app"
DMG_PATH="dist/AntiProfiles-macOS-arm64.dmg"
ENTITLEMENTS_PATH="build/entitlements.mac.plist"
ENTITLEMENTS_INHERIT="build/entitlements.mac.inherit.plist"

echo "========================================================"
echo " AntiProfiles macOS Code Signing & Notarization Pipeline"
echo "========================================================"

# 1. Check if Apple Developer Certificate is provided
SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"

if [ -z "$SIGNING_IDENTITY" ]; then
    # Try finding an installed Developer ID certificate in Keychain
    SIGNING_IDENTITY=$(security find-identity -p codesigning -v | grep "Developer ID Application" | head -n 1 | awk -F'"' '{print $2}' || true)
fi

if [ -n "$SIGNING_IDENTITY" ]; then
    echo "✓ Found Developer ID Signing Identity: $SIGNING_IDENTITY"
    SIGN_FLAG="$SIGNING_IDENTITY"
else
    echo "⚠️  No 'Developer ID Application' certificate found in Keychain."
    echo "    Using ad-hoc signature (-) for local development build."
    SIGN_FLAG="-"
fi

echo ""
echo "[Step 1/5] Verifying arm64 Architecture..."
file "$APP_PATH/Contents/MacOS/AntiProfiles" | grep -q "arm64" && echo "✓ Native arm64 executable verified."

echo ""
echo "[Step 2/5] Recursively signing embedded frameworks, helpers, and native modules..."

# Deep-sign all .node native binaries with Hardened Runtime entitlements
find "$APP_PATH" -type f -name "*.node" -o -name "*.dylib" | while read -r binary; do
    echo "  Signing native module: $(basename "$binary")"
    codesign --force --timestamp --options runtime --entitlements "$ENTITLEMENTS_PATH" --sign "$SIGN_FLAG" "$binary"
done

# Sign Helper apps and Frameworks
if [ -d "$APP_PATH/Contents/Frameworks" ]; then
    find "$APP_PATH/Contents/Frameworks" -name "*.app" -o -name "*.framework" | while read -r item; do
        echo "  Signing framework/helper: $(basename "$item")"
        codesign --force --timestamp --options runtime --entitlements "$ENTITLEMENTS_INHERIT" --sign "$SIGN_FLAG" "$item"
    done
fi

# Sign main app bundle
echo "  Signing main application bundle: AntiProfiles.app"
codesign --force --timestamp --options runtime --entitlements "$ENTITLEMENTS_PATH" --sign "$SIGN_FLAG" "$APP_PATH"

echo ""
echo "[Step 3/5] Validating Code Signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
echo "✓ Code signature is valid on disk and satisfies Designated Requirements."

# If valid Apple Developer Identity is present and Notarization credentials exist, submit to Apple
if [ "$SIGN_FLAG" != "-" ] && [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
    echo ""
    echo "[Step 4/5] Packaging signed application into DMG..."
    npx electron-builder --mac dmg --arm64 --prepackaged "$APP_PATH"

    echo ""
    echo "[Step 5/5] Submitting DMG to Apple Notary Service..."
    xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$APPLE_ID" \
        --team-id "$APPLE_TEAM_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --wait

    echo "  Stapling notarization ticket to DMG..."
    xcrun stapler staple "$DMG_PATH"
    xcrun stapler validate "$DMG_PATH"
    echo "✓ Notarization and ticket stapling complete! DMG is ready for public distribution."
else
    echo ""
    echo "[Notice] To notarize for public distribution without Gatekeeper prompts, configure:"
    echo "  export APPLE_ID='your-apple-id@example.com'"
    echo "  export APPLE_APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx'"
    echo "  export APPLE_TEAM_ID='XXXXXXXXXX'"
    echo "  export APPLE_SIGNING_IDENTITY='Developer ID Application: Your Name (XXXXXXXXXX)'"
fi

echo ""
echo "========================================================"
echo " Pipeline Complete!"
echo "========================================================"
