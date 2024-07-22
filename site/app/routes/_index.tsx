import {
	json,
	type MetaFunction,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-date-fns'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'
import { maxBy, minBy, meanBy } from 'lodash-es'

import * as schema from '../../../db/schema'
import { type Entry } from '../../../db/schema'
import { useLoaderData, useNavigate, Form, useSubmit } from '@remix-run/react'
import { useEffect, useRef } from 'react'
import { subDays, subHours } from 'date-fns'

type Timespan = 'last_day' | 'last_hour' | 'all'

export const meta: MetaFunction = () => {
	return [
		{ title: "Ty's Raspberry Pi" },
		{ name: 'description', content: "Ty's Raspberry Pi website" },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const firstDs18b20EntryTimestamp = '2024-07-20T03:23:02.513Z'
	const sqlite = new Database('../database.db')
	const db = drizzle(sqlite, { schema, logger: true })

	const url = new URL(request.url)
	const timespan = url.searchParams.get('timespan') as Timespan
	const now = new Date()

	const startTimestamp =
		timespan === 'last_hour'
			? subHours(now, 1).toISOString()
			: timespan === 'all'
			? firstDs18b20EntryTimestamp
			: subDays(now, 1).toISOString()

	const entries = await db.query.entries.findMany({
		where: (entries, { gte }) => gte(entries.timestamp, startTimestamp),
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
				<div>Current temperature</div>
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
								hidden: true,
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
	)
}

function Stats({ entries }: { entries: Entry[] }) {
	const high = maxBy(entries, 'ds18b20')
	const low = minBy(entries, 'ds18b20')
	const average = meanBy(entries, 'ds18b20')

	return (
		<div className="flex place-content-between">
			<div>
				<div className="text-sm">High</div>
				<div className="text-3xl lg:text-5xl">
					{formatNumber(high.ds18b20)}°C
				</div>
				<div className="text-sm">{formatDate(high.timestamp)}</div>
			</div>
			<div>
				<div className="text-sm">Low</div>
				<div className="text-3xl lg:text-5xl">
					{formatNumber(low.ds18b20)}°C
				</div>
				<div className="text-sm">{formatDate(low.timestamp)}</div>
			</div>
			<div>
				<div className="text-sm">Average</div>
				<div className="text-3xl lg:text-5xl">{formatNumber(average)}°C</div>
			</div>
		</div>
	)
}

export default function Index() {
	const entries = useLoaderData<typeof loader>()
	const submit = useSubmit()
	const [firstEntry, ...restOfEntries] = entries
	useReloadOnView()

	return (
		<div className="font-sans p-4 max-w-[500px] lg:max-w-[750px] mx-auto space-y-12">
			<h1 className="text-3xl">Ty&apos;s Raspberry Pi</h1>
			<LatestEntry entry={firstEntry} />
			<div>
				<h2 className="text-2xl mb-5">Temp history</h2>
				<Form
					method="GET"
					onChange={(event) => {
						submit(event.currentTarget)
					}}
					className="mb-3"
				>
					<Select name="timespan" defaultValue="last_day">
						<SelectTrigger className="w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="last_day">Last day</SelectItem>
							<SelectItem value="last_hour">Last hour</SelectItem>
							<SelectItem value="all">All</SelectItem>
						</SelectContent>
					</Select>
				</Form>
				<EntryChart entries={entries} />
			</div>
			<Stats entries={entries} />
			<TempHistory entries={restOfEntries} />
		</div>
	)
}
