import { readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { entries } from '../db/schema'
import * as schema from '../db/schema'

const sqlite = new Database('/app/database.db')
const db = drizzle(sqlite, { schema, logger: true })

for (let i = 0; i < 10; i++) {
	try {
		const data = readFileSync('/app/in_temp_input', 'utf8')

		const lines = data.split('\n')
		const firstLine = lines[0]
		const temp = Number(firstLine) / 1000

		const timestamp = new Date().toISOString()

		const dbEntry = {
			timestamp,
			value: temp,
		}
		db.insert(entries)
			.values(dbEntry)
			.then(() => {
				console.log(`Inserted ${temp} at ${timestamp}`)
			})
		break
	} catch (err) {
		if (err instanceof Error && 'code' in err && err.code !== 'EIO') {
			console.error(err)
		}
	}
}
