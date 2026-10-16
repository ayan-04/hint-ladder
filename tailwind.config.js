/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/popup/**/*.html", "./src/popup/**/*.tsx", "./src/options/**/*.html", "./src/options/**/*.tsx", "./src/pages/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1915",
        paper: "#f6f1e8",
        amber: "#e08a3c",
        rung: "#c45c26",
      },
      fontFamily: {
        sans: ["Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
