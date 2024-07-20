import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const visits = sqliteTable('visits', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	timestamp: text('timestamp').notNull(),
})

export type Visit = typeof visits.$inferSelect

export const entries = sqliteTable('entries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	timestamp: text('timestamp').notNull(),
	dht11: real('dht11').notNull(),
	ds18b20: real('ds18b20'),
})

export type Entry = typeof entries.$inferSelect
