module.exports = {
  projects: [
    {
      displayName: "fit",
      testEnvironment: "node",
      modulePathIgnorePatterns: ["<rootDir>/.claude/"],
      testMatch: ["<rootDir>/src/fit/**/*.test.ts"],
      transform: { "^.+\\.[jt]sx?$": ["babel-jest", { configFile: "./babel.config.js" }] },
      transformIgnorePatterns: ["/node_modules/(?!@garmin/fitsdk/)"],
    },
    {
      displayName: "app",
      preset: "jest-expo",
      testMatch: ["**/*.test.ts", "**/*.test.tsx"],
      testPathIgnorePatterns: [
        "/node_modules/",
        "<rootDir>/src/db/__tests__/",
        "<rootDir>/src/db/migrations.test.ts",
        "<rootDir>/scripts/import-history/",
        "<rootDir>/src/fit/",
      ],
    },
    {
      displayName: "db",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/src/db/__tests__/**/*.test.ts",
        "<rootDir>/src/db/migrations.test.ts",
      ],
      transform: {
        "^.+\\.tsx?$": ["babel-jest", { configFile: "./babel.config.js" }],
      },
      moduleNameMapper: {
        "^expo-sqlite$": "<rootDir>/src/db/__tests__/mocks/expo-sqlite.js",
      },
    },
    {
      displayName: "import-history",
      testEnvironment: "node",
      testMatch: ["<rootDir>/scripts/import-history/**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": ["babel-jest", { configFile: "./babel.config.js" }],
      },
    },
  ],
};
