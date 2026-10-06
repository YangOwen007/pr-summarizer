import nextVitals from "eslint-config-next/core-web-vitals";

// Next.js ships a solid baseline lint setup, so we extend it instead of reinventing rules.
const config = [...nextVitals, { ignores: ["artifacts/**"] }];

export default config;
