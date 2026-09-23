import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: [".next/**", ".next-*/**", "node_modules/**", "data/**"] },
  // `next build` detects the plugin by resolving the config for eslint.config.mjs itself, so registration must not be limited by `files`.
  { plugins: nextPlugin.flatConfig.recommended.plugins },
  {
    ...nextPlugin.flatConfig.recommended,
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } }
    }
  }
];
