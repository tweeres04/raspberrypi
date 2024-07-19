import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const visits = sqliteTable('visits', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	timestamp: text('timestamp').notNull(),
})

export type Visit = typeof visits.$inferSelect

export const entries = sqliteTable('entries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	timestamp: text('timestamp').notNull(),
	value: real('value').notNull(),
})

export type Entry = typeof entries.$inferSelect
