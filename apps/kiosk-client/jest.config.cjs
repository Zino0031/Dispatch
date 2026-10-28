/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  transform: {
    "^(?!.*\\.(d|ctsx?)$)": [
      "ts-jest",
      {
        isolatedModules: true,
        tsconfig: {
          module: "CommonJS",
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  rootDir: ".",
};
