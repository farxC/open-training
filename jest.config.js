module.exports = {
  projects: [
    {
      displayName: "app",
      preset: "jest-expo",
      testMatch: ["**/*.test.ts", "**/*.test.tsx"],
      testPathIgnorePatterns: [
        "/node_modules/",
        "<rootDir>/src/db/__tests__/",
        "<rootDir>/src/db/migrations.test.ts",
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
    },
  ],
};
