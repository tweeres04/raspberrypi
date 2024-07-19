import { json, type MetaFunction } from '@remix-run/node'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'

import * as schema from '../../../db/schema'
import { Entry } from '../../../db/schema'
import { useLoaderData } from '@remix-run/react'

export const meta: MetaFunction = () => {
	return [
		{ title: "Ty's Raspberry Pi" },
		{ name: 'description', content: "Ty's Raspberry Pi website" },
	]
}

export async function loader() {
	const sqlite = new Database('../database.db')
	const db = drizzle(sqlite, { schema, logger: true })

	const entries = await db.query.entries.findMany({
		orderBy: (entries, { desc }) => [desc(entries.id)],
	})

	return json<Entry[]>(entries)
}

export default function Index() {
	const entries = useLoaderData<typeof loader>()

	return (
		<div className="font-sans p-4 container mx-auto">
			<h1 className="text-3xl mb-3">Ty&apos;s Raspberry Pi</h1>
			<ul className="space-y-1">
				{entries.map((e: Entry) => (
					<li key={e.id}>
						{e.id} {new Date(e.timestamp).toLocaleString()} - {e.value}°C
					</li>
				))}
			</ul>
		</div>
	)
}
