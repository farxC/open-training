.DEFAULT_GOAL := help

ANDROID_DIR := android
APK_DEBUG := $(ANDROID_DIR)/app/build/outputs/apk/debug/app-debug.apk
APK_RELEASE := $(ANDROID_DIR)/app/build/outputs/apk/release/app-release.apk

# .env.local (already covered by .gitignore's `.env*.local` pattern) lets you
# keep the 4 signing vars (+ optionally JAVA_HOME) on disk instead of
# exporting them every session — copy .env.local.example to .env.local and
# fill in real values. No quotes: this file is included as Make syntax, not
# sourced as shell, so quote characters would end up inside the value.
-include .env.local
export ANDROID_RELEASE_STORE_FILE
export ANDROID_RELEASE_STORE_PASSWORD
export ANDROID_RELEASE_KEY_ALIAS
export ANDROID_RELEASE_KEY_PASSWORD
export JAVA_HOME
export ANDROID_HOME

.PHONY: help
help:
	@echo "Android build targets:"
	@echo "  make android-debug    Build an unsigned debug APK (no keystore needed)"
	@echo "  make android-release  Build a signed release APK (needs a local keystore + env vars, see below)"
	@echo "  make run              Build, install and launch the debug build on a connected device/emulator"
	@echo "  make install-debug    adb install the last built debug APK"
	@echo "  make install-release  adb install the last built release APK"
	@echo "  make prebuild         Force-regenerate the android/ directory from app.json"
	@echo "  make clean            Remove the generated android/ directory"
	@echo ""
	@echo "android-release reads these env vars (same names the CI workflow uses):"
	@echo "  ANDROID_RELEASE_STORE_FILE      path to your .keystore (relative paths resolve inside android/app/)"
	@echo "  ANDROID_RELEASE_STORE_PASSWORD"
	@echo "  ANDROID_RELEASE_KEY_ALIAS"
	@echo "  ANDROID_RELEASE_KEY_PASSWORD"
	@echo ""
	@echo "Easiest way to set them: cp .env.local.example .env.local, fill in real values."
	@echo "The Makefile loads .env.local automatically (it's git-ignored)."

# android/gradlew only exists after a successful prebuild, so it doubles as
# a freshness marker: `make android-debug` re-prebuilds when android/ is
# missing but stays fast on repeat runs by skipping it otherwise.
$(ANDROID_DIR)/gradlew:
	npx expo prebuild --platform android --no-install
	chmod +x $(ANDROID_DIR)/gradlew

.PHONY: prebuild
prebuild:
	rm -rf $(ANDROID_DIR)
	npx expo prebuild --platform android --no-install
	chmod +x $(ANDROID_DIR)/gradlew

.PHONY: android-debug
android-debug: $(ANDROID_DIR)/gradlew
	cd $(ANDROID_DIR) && ./gradlew assembleDebug
	@echo "APK: $(APK_DEBUG)"

.PHONY: android-release
android-release: $(ANDROID_DIR)/gradlew
	@test -n "$$ANDROID_RELEASE_STORE_FILE" && test -n "$$ANDROID_RELEASE_STORE_PASSWORD" \
		&& test -n "$$ANDROID_RELEASE_KEY_ALIAS" && test -n "$$ANDROID_RELEASE_KEY_PASSWORD" || \
		(echo "Missing one of ANDROID_RELEASE_STORE_FILE / ANDROID_RELEASE_STORE_PASSWORD / ANDROID_RELEASE_KEY_ALIAS / ANDROID_RELEASE_KEY_PASSWORD — run 'make help' for details." && exit 1)
	cd $(ANDROID_DIR) && ./gradlew assembleRelease
	@echo "APK: $(APK_RELEASE)"

.PHONY: run
run:
	npx expo run:android

.PHONY: install-debug
install-debug:
	adb install -r $(APK_DEBUG)

.PHONY: install-release
install-release:
	adb install -r $(APK_RELEASE)

.PHONY: clean
clean:
	rm -rf $(ANDROID_DIR)
