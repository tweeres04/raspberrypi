import { drizzle } from 'drizzle-orm/better-sqlite3'
import { count, isNotNull } from 'drizzle-orm'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('./database.db')
const db = drizzle(sqlite, { schema, logger: true })

const entriesCount = await db.select({ count: count() }).from(schema.entriesOld)

console.log(`Records to migrate: ${entriesCount[0].count}`)

const ds18b20Entries = await db
	.select()
	.from(schema.entriesOld)
	.where(isNotNull(schema.entriesOld.ds18b20))

const newDs18b20Entries: schema.NewEntry[] = ds18b20Entries.map((e) => ({
	timestamp: e.timestamp,
	source: 'front_room',
	temperature: e.ds18b20 as number,
}))

const dht11Entries = await db
	.select()
	.from(schema.entriesOld)
	.where(isNotNull(schema.entriesOld.dht11))

const newDht11Entries: schema.NewEntry[] = dht11Entries.map((e) => ({
	timestamp: e.timestamp,
	source: 'dht11',
	temperature: e.dht11 as number,
}))

const newEntries = [...newDs18b20Entries, ...newDht11Entries]

newEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

await db.insert(schema.entries).values(newEntries)
