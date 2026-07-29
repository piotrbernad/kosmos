import nextPlugin from "eslint-config-next";

/**
 * eslint-config-next 16 exports a flat-config array directly.
 * TypeScript rules that need the type-checker are gated behind TS >= 5.1.
 */
const eslintConfig = [
  ...nextPlugin,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "playwright-report/**",
      "test-results/**",
      "e2e/.auth/**",
    ],
  },
];

export default eslintConfig;
