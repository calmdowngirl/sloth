import { type Config } from "npm:tailwindcss@^3.4.1";
export default {
  content: [
    "{routes,islands,components}/**/*.{ts,tsx,js,jsx}",
  ],
} satisfies Config;
