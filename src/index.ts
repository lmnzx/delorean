import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, or, sql } from 'drizzle-orm';
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

    let primaryContact = null;

    const turso = createClient({
        url: c.env.TURSO_DB_URL,
        authToken: c.env.TURSO_DB_AUTH_TOKEN
    })

    const db = drizzle(turso, { schema: { contacts } });

    // Find existing contacts
    const existingContact = await db.select().from(contacts).where(
        or(
            eq(contacts.email, email || ''),
            eq(contacts.phoneNumber, phoneNumber || '')
        )
    );

    if (existingContact.length > 0) {
        const primaryContactId = existingContact[0].linkedId
        if (!primaryContactId) {
            primaryContact = existingContact[0]
        } else {
            primaryContact = await db.query.contacts.findFirst({
                where: eq(contacts.id, primaryContactId)
            })
        }

        if (primaryContact && (email !== primaryContact.email || phoneNumber !== primaryContact.phoneNumber) && email && phoneNumber) {
            // Update an existing primary contact
            const checkContactEmail = await db.query.contacts.findFirst({
                where: eq(contacts.email, email)
            })
            const checkContactPhoneNumber = await db.query.contacts.findFirst({
                where: eq(contacts.phoneNumber, phoneNumber)
            })
            if (checkContactEmail && checkContactPhoneNumber) {
                // Keeping the oldest contact as primary
                const secondaryContact = new Date(checkContactEmail.createdAt) > new Date(checkContactPhoneNumber.createdAt) ? checkContactEmail : checkContactPhoneNumber;
                primaryContact = new Date(checkContactEmail.createdAt) < new Date(checkContactPhoneNumber.createdAt) ? checkContactEmail : checkContactPhoneNumber;

                await db.update(contacts).set({
                    // Eliminate: secondary -> secondary -> primary condition only link primary
                    linkedId: primaryContact.linkPrecedence === 'secondary' ? primaryContact.linkedId : primaryContact.id,
                    linkPrecedence: 'secondary',
                    updatedAt: sql`(strftime('%s', 'now'))`
                }).where(eq(contacts.id, secondaryContact.id))
            } else {
                // Adding a new secondary contact
                const newEmail = primaryContact.email === email ? primaryContact.email : email;
                const newPhoneNumber = primaryContact.phoneNumber === phoneNumber ? primaryContact.phoneNumber : phoneNumber;
                await db.insert(contacts).values({
                    email: newEmail,
                    phoneNumber: newPhoneNumber,
                    linkPrecedence: 'secondary',
                    // Eliminate: secondary -> secondary -> primary condition only link primary 
                    linkedId: primaryContact.linkPrecedence === 'secondary' ? primaryContact.linkedId : primaryContact.id
                })
            }
        }
    } else if (email && phoneNumber) {
        // Create a new primary contact 
        primaryContact = (await db.insert(contacts).values({
            email,
            phoneNumber,
            linkPrecedence: 'primary'
        }).returning())[0];
    }

    if (primaryContact) {
        const primaryId = primaryContact.linkPrecedence === 'secondary' ? primaryContact.linkedId : primaryContact.id
        if (primaryId) {
            const secondaryContacts = await db.query.contacts.findMany({
                where: eq(contacts.linkedId, primaryId)
            })

            const response = {
                contacts: {
                    primaryContactId: primaryId,
                    emails: [primaryContact.email, ...secondaryContacts.map(c => c.email)].filter((v, i, a) => v && a.indexOf(v) === i),
                    phoneNumbers: [primaryContact.phoneNumber, ...secondaryContacts.map(c => c.phoneNumber)].filter((v, i, a) => v && a.indexOf(v) === i),
                    secondaryContactIds: secondaryContacts.map(c => c.id)

                }
            }
            return c.json(response)
        }
    } else {
        return c.json({ error: "Contact was not found :(" }, 400)
    }
});

export default app;
