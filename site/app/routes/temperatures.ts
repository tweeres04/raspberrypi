import { ActionFunctionArgs } from '@remix-run/node'
import { ZodError } from 'zod'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'

import * as schema from '../../../db/schema'
import { entries, insertEntrySchema } from '../../../db/schema'

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const updates = Object.fromEntries(formData)

	try {
		const entry = insertEntrySchema.parse({
			timestamp: new Date().toISOString(),
			source: updates.source,
			temperature: updates.temperature
				? Number(updates.temperature)
				: undefined,
		})

		const sqlite = new Database('../database.db')
		const db = drizzle(sqlite, { schema, logger: true })
		await db.insert(entries).values(entry)

		return new Response(null, { status: 201 })
	} catch (err) {
		if (err instanceof ZodError) {
			return new Response(err.message, { status: 400 })
		} else {
			throw err
		}
	}
}
