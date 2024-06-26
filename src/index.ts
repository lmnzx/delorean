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
    let secondaryContacts = [];

    const turso = createClient({
        url: c.env.TURSO_DB_URL,
        authToken: c.env.TURSO_DB_AUTH_TOKEN
    })

    const db = drizzle(turso);

    // Find existing contacts
    const existingContacts = await db.select().from(contacts).where(
        or(
            eq(contacts.email, email || ''),
            eq(contacts.phoneNumber, phoneNumber || '')
        )
    );

    if (existingContacts.length > 0) {
        // Sort contacts by createdAt to ensure the oldest is first
        existingContacts.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateA.getTime() - dateB.getTime();
        });

        // The oldest contact should be primary
        primaryContact = existingContacts[0];

        // Update or create secondary contacts
        for (let i = 1; i < existingContacts.length; i++) {
            const contact = existingContacts[i];
            if (contact.id !== primaryContact.id) {
                await db.update(contacts)
                    .set({
                        linkedId: primaryContact.id,
                        linkPrecedence: 'secondary',
                        updatedAt: sql`(strftime('%s', 'now'))`
                    })
                    .where(eq(contacts.id, contact.id));
                secondaryContacts.push({ ...contact, linkedId: primaryContact.id, linkPrecedence: 'secondary' });
            }
        }

        // Create a new secondary contact if new information is provided
        const newEmail = email && !existingContacts.some(c => c.email === email);
        const newPhoneNumber = phoneNumber && !existingContacts.some(c => c.phoneNumber === phoneNumber);

        if (newEmail || newPhoneNumber) {
            const newSecondaryContact = await db.insert(contacts).values({
                email: newEmail ? email : primaryContact.email,
                phoneNumber: newPhoneNumber ? phoneNumber : primaryContact.phoneNumber,
                linkedId: primaryContact.id,
                linkPrecedence: 'secondary'
            }).returning();
            secondaryContacts.push(newSecondaryContact[0]);
        }
    } else {
        // Create a new primary contact 
        if (email && phoneNumber) {
            primaryContact = (await db.insert(contacts).values({
                email,
                phoneNumber,
                linkPrecedence: 'primary'
            }).returning())[0];
        } else {
            return c.json({ error: "Contact was not fount, need both email and phoneNumber are required for creating a primary contact" }, 400);
        }
    }

    // Prepare the response
    const response = {
        contact: {
            primaryContactId: primaryContact.id,
            emails: [primaryContact.email, ...secondaryContacts.map(c => c.email)].filter((v, i, a) => v && a.indexOf(v) === i),
            phoneNumbers: [primaryContact.phoneNumber, ...secondaryContacts.map(c => c.phoneNumber)].filter((v, i, a) => v && a.indexOf(v) === i),
            secondaryContactIds: secondaryContacts.map(c => c.id)
        }
    };

    return c.json(response);
});

export default app;
