import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';

import { contacts } from './db/schema'

type Bindings = {
    TURSO_DB_URL: string
    TURSO_DB_AUTH_TOKEN: string
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/identify', async (c) => {
    const { email, phoneNumber } = await c.req.json();

    if (!email && !phoneNumber) {
        return c.json({ error: "Either email or phoneNumber is required" }, 400);
    }

    const turso = createClient({
        url: c.env.TURSO_DB_URL,
        authToken: c.env.TURSO_DB_AUTH_TOKEN
    })

    const db = drizzle(turso);

    const res = await db.select().from(contacts).all();

    console.log(email, phoneNumber, res)

    return c.text("hiii");
});

export default app;
