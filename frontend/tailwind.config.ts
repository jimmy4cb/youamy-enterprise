import type { Config } from "tailwindcss";

const config: Config = {
  content: {
    relative: true,
    files: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  },
  theme: {
    extend: {
      colors: {
        yel: {
          navy: "#0B2447",
          gold: "#D4A72C",
          red: "#C81E27",
          blue: "#2563EB",
          canvas: "#F4F6F9",
        },
      },
      fontFamily: {
        sans: ["Inter", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
