import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#12142B", // main app background (navy)
          card: "#181A33", // card / input background
          border: "#2C2F4F", // hairline borders
        },
        brand: {
          red: "#B23A3A", // gradient start (Save Rules / primary buttons)
          maroon: "#7A1F1F", // gradient end
          blue: "#3D5CDB", // Start Count button
        },
        status: {
          under: "#8B8FA8", // gray "UNDER" badge
          ontime: "#22A559", // green "ON TIME" badge + background
          overtime: "#B4231F", // red "OVERTIME" badge + background
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
