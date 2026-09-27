/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
        },
      },
    },
  },
  plugins: [],
};