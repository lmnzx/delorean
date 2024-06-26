import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const contacts = sqliteTable('contacts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    phoneNumber: text('phone_number'),
    email: text('email'),
    linkedId: integer('linked_id'),
    linkPrecedence: text('link_precedence').default('primary'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
});
