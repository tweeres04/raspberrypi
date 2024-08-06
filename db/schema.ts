import {
	sqliteTable,
	integer,
	text,
	real,
	index,
} from 'drizzle-orm/sqlite-core'

export const entries = sqliteTable(
	'entries_new',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		timestamp: text('timestamp').notNull(),
		source: text('source').notNull(),
		temperature: real('temperature').notNull(),
	},
	(table) => ({
		timestampSourceIdx: index('entries_timestamp_index').on(table.timestamp),
	})
)

export type Entry = typeof entries.$inferSelect
export type NewEntry = typeof entries.$inferInsert
