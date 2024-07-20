import { readFile } from 'node:fs/promises'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { entries } from '../db/schema'
import * as schema from '../db/schema'

const sqlite = new Database('/app/database.db')
const db = drizzle(sqlite, { schema, logger: true })

async function getDht11Temp() {
	for (let i = 0; i < 10; i++) {
		try {
			const data = await readFile('/app/in_temp_input', 'utf8')

			const lines = data.split('\n')
			const firstLine = lines[0]
			const temp = Number(firstLine) / 1000

			return temp
		} catch (err) {
			if (err instanceof Error && 'code' in err && err.code !== 'EIO') {
				console.error(err)
			}
		}
	}
}

async function getDs18b20Temp() {
	const data = await readFile('/app/w1_slave', 'utf8')

	const lines = data.split('\n')
	const secondLine = lines[1]
	const [, tempPart] = secondLine.split('=')
	const temp = Number(tempPart) / 1000

	return temp
}

const [dht11, ds18b20] = await Promise.all([getDht11Temp(), getDs18b20Temp()])

const timestamp = new Date().toISOString()

const dbEntry = {
	timestamp,
	dht11,
	ds18b20,
}

db.insert(entries)
	.values(dbEntry)
	.then(() => {
		console.log('Inserted')
		console.log(dbEntry)
	})
