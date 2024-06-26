import type { Config } from 'drizzle-kit';

export default {
    driver: "turso",
    dialect: "sqlite",
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
} satisfies Config;
