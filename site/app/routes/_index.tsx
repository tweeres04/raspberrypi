import { json, type MetaFunction } from '@remix-run/node'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'

import * as schema from '../../../db/schema'
import { type Entry } from '../../../db/schema'
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

function formatDate(date: string) {
	return new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(date))
}

function LatestEntry({ entry }: { entry: Entry }) {
	return (
		<div className="my-10">
			<div>Latest entry</div>
			<div className="text-5xl">{entry.ds18b20}°C</div>
			<div>{formatDate(entry.timestamp)}</div>
		</div>
	)
}

function Entry({ entry }: { entry: Entry }) {
	return (
		<tr>
			<td>{formatDate(entry.timestamp)}</td>
			<td className="text-right">{entry.dht11}°C</td>
			<td className="text-right">{entry.ds18b20}°C</td>
		</tr>
	)
}

export default function Index() {
	const entries = useLoaderData<typeof loader>()

	const [firstEntry, ...restOfEntries] = entries

	return (
		<div className="font-sans p-4 max-w-[500px] lg:max-w-[750px] mx-auto">
			<h1 className="text-3xl mb-3">Ty&apos;s Raspberry Pi</h1>
			<LatestEntry entry={firstEntry} />
			<h2 className="text-2xl mb-3">Temp history</h2>
			<table className="w-full">
				<thead>
					<tr>
						<th>Timestamp</th>
						<th className="text-right">dht11</th>
						<th className="text-right">ds18b20</th>
					</tr>
				</thead>
				{restOfEntries.map((e: Entry) => (
					<Entry entry={e} key={e.id} />
				))}
			</table>
		</div>
	)
}
