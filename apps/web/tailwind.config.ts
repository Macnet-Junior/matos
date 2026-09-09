import type { Config } from "tailwindcss";
import matosPreset from "@matos/ui/tailwind-preset";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [matosPreset as unknown as Config],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
