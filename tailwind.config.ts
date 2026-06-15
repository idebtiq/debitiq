import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07111f",
        mint: "#38d6a3",
        gold: "#f3c969",
        danger: "#ef4444",
      },
      boxShadow: {
        premium: "0 18px 55px rgba(7, 17, 31, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
