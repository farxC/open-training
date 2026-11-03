module.exports = {
  ignorePatterns: ["dist/", "web-build/", "android/", "ios/", ".claude/", ".codex/"],
  extends: ["expo"],
  rules: {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
  },
};
