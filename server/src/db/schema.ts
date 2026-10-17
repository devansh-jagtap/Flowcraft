import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar, type AnyPgColumn } from 'drizzle-orm/pg-core';
import type { DiagramTheme, DiagramType, Direction } from '../models/constants.js';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** Local record of a Clerk account. Clerk owns sign-in; we keep what diagrams need to reference. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Missing only on seeded/legacy users that haven't been claimed by a Clerk sign-in yet.
  clerkId: text('clerk_id').unique(),
  name: varchar('name', { length: 60 }).notNull(),
  // Stored lowercase. Postgres allows many NULLs in a unique column.
  email: text('email').unique(),
  ...timestamps,
});

export interface Point {
  x: number;
  y: number;
}

export interface PromptEntry {
  text: string;
  createdAt: string;
}

export const diagrams = pgTable(
  'diagrams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 100 }).notNull().default('Untitled diagram'),
    type: text('type').$type<DiagramType>().notNull(),
    /** The plain-text description the diagram is generated from. */
    source: text('source').notNull().default(''),
    theme: text('theme').$type<DiagramTheme>().notNull().default('ocean'),
    direction: text('direction').$type<Direction>().notNull().default('TB'),
    /** Node positions the user dragged manually, keyed by node id. Auto-layout fills the rest. */
    positions: jsonb('positions').$type<Record<string, Point>>().notNull().default({}),
    /** The AI prompts that built this diagram, oldest first (shown as a chat history). */
    prompts: jsonb('prompts').$type<PromptEntry[]>().notNull().default([]),
    starred: boolean('starred').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    shareId: text('share_id').unique(),
    views: integer('views').notNull().default(0),
    forkedFrom: uuid('forked_from').references((): AnyPgColumn => diagrams.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('diagrams_owner_updated_idx').on(t.ownerId, t.updatedAt.desc())]
);

/** How many free AI generations a visitor (signed-in user or guest IP) has used in the current window. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    /** "user:<id>" for signed-in users, "ip:<address>" for guests. */
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    resetsAt: timestamp('resets_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('ai_usage_resets_at_idx').on(t.resetsAt)]
);

export type User = typeof users.$inferSelect;
export type DiagramRow = typeof diagrams.$inferSelect;
export type NewDiagram = typeof diagrams.$inferInsert;

/** Case-insensitive sort key for titles. */
export const lowerTitle = sql`lower(${diagrams.title})`;
