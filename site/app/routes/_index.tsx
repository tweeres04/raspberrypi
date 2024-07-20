import { json, type MetaFunction } from '@remix-run/node'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-date-fns'

import * as schema from '../../../db/schema'
import { type Entry } from '../../../db/schema'
import { useLoaderData, useNavigate } from '@remix-run/react'
import { useEffect, useRef } from 'react'

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

function formatNumber(number: number) {
	return new Intl.NumberFormat('en-CA', {
		style: 'decimal',
		maximumFractionDigits: 1,
	}).format(number)
}

function LatestEntry({ entry }: { entry: Entry }) {
	return (
		<div className="flex place-content-around">
			<div>
				<div>Latest entry</div>
				<div className="text-8xl">
					{formatNumber(entry.ds18b20 as number)}°C
				</div>
				<div>{formatDate(entry.timestamp)}</div>
			</div>
		</div>
	)
}

function Entry({ entry }: { entry: Entry }) {
	return (
		<tr>
			<td>{formatDate(entry.timestamp)}</td>
			<td className="text-right">{formatNumber(entry.dht11)}°C</td>
			<td className="text-right">
				{entry.ds18b20 ? `${formatNumber(entry.ds18b20)}°C` : null}
			</td>
		</tr>
	)
}

function useReloadOnView() {
	const navigate = useNavigate()

	useEffect(() => {
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) {
				navigate('.', { replace: true })
			}
		})
	}, [navigate])
}

function EntryChart({ entries }: { entries: Entry[] }) {
	const chartRef = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		entries.reverse()
		let chart = null
		if (chartRef.current) {
			{
				chart = new Chart(chartRef.current, {
					type: 'line',
					data: {
						labels: entries.map((e) => e.timestamp),
						datasets: [
							{
								label: 'ds18b20',
								data: entries.map((e) => e.ds18b20),
							},
							{
								label: 'dt11',
								data: entries.map((e) => e.dht11),
							},
						],
					},
					options: {
						scales: {
							x: {
								type: 'time',
							},
						},
						elements: {
							point: {
								pointStyle: false,
							},
						},
						maintainAspectRatio: false,
					},
				})
			}
		}

		return function cleanup() {
			chart?.destroy()
		}
	}, [entries])

	return (
		<canvas id="entry_chart" ref={chartRef} className="max-h-[400px]"></canvas>
	)
}

function TempHistory({ entries }: { entries: Entry[] }) {
	return (
		<div>
			<h2 className="text-2xl mb-3">Temp history</h2>
			<table className="w-full">
				<thead>
					<tr>
						<th>Timestamp</th>
						<th className="text-right">dht11</th>
						<th className="text-right">ds18b20</th>
					</tr>
				</thead>
				{entries.map((e: Entry) => (
					<Entry entry={e} key={e.id} />
				))}
			</table>
		</div>
	)
}

export default function Index() {
	const entries = useLoaderData<typeof loader>()
	const [firstEntry, ...restOfEntries] = entries
	useReloadOnView()

	return (
		<div className="font-sans p-4 max-w-[500px] lg:max-w-[750px] mx-auto space-y-14">
			<h1 className="text-3xl mb-3">Ty&apos;s Raspberry Pi</h1>
			<LatestEntry entry={firstEntry} />
			<EntryChart entries={entries} />
			<TempHistory entries={restOfEntries} />
		</div>
	)
}
