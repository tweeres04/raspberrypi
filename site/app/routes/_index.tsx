import {
	json,
	type MetaFunction,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { and, asc, gte, inArray, not } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import 'chartjs-adapter-date-fns'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import { maxBy, minBy, meanBy, groupBy } from 'lodash-es'
import tailwindColors from 'tailwindcss/colors'

import * as schema from '../../../db/schema'
import { type Entry } from '../../../db/schema'
import {
	useLoaderData,
	Form,
	useSubmit,
	useSearchParams,
	useRevalidator,
} from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import {
	addDays,
	addHours,
	addWeeks,
	subDays,
	subHours,
	subWeeks,
} from 'date-fns'

import Chart from 'chart.js/auto'
import { tempSourceLabels } from '~/lib/tempSourceLabels'

function getSourceColor(source: string) {
	return source === 'blue_room'
		? tailwindColors.sky
		: source === 'master_bedroom'
		? tailwindColors.emerald
		: source === 'main_room'
		? tailwindColors.violet
		: source === 'basement'
		? tailwindColors.amber
		: source === 'pink_room'
		? tailwindColors.pink
		: source === 'back_yard'
		? tailwindColors.lime
		: tailwindColors.stone
}

type Timespan = 'last_week' | 'last_day' | 'last_hour' | 'all'

export const meta: MetaFunction = () => {
	return [
		{ title: 'Kiwi Temps' },
		{ name: 'description', content: 'Kiwi Temps' },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const firstDs18b20EntryTimestamp = '2024-07-20T03:23:02.513Z'
	const sqlite = new Database('../database.db')
	const db = drizzle(sqlite, { schema, logger: true })

	const url = new URL(request.url)
	const timespan = url.searchParams.get('timespan') as Timespan
	const source = url.searchParams.get('stats_source')
	const showComparison = url.searchParams.has('show_comparison')
	const now = new Date()

	const [startTimestamp, comparisonStart, comparisonEnd] =
		timespan === 'last_hour'
			? [subHours(now, 1), subHours(now, 2), subHours(now, 1)].map((d) =>
					d.toISOString()
			  )
			: timespan === 'last_week'
			? [subWeeks(now, 1), subWeeks(now, 2), subWeeks(now, 1)].map((d) =>
					d.toISOString()
			  )
			: timespan === 'all'
			? [firstDs18b20EntryTimestamp]
			: // timespan === 'last_day'
			  [subDays(now, 1), subDays(now, 2), subDays(now, 1)].map((d) =>
					d.toISOString()
			  )

	const sourcesPromise = db
		.selectDistinct({ source: schema.entries.source })
		.from(schema.entries)
		.where(
			and(
				gte(schema.entries.timestamp, startTimestamp),
				not(inArray(schema.entries.source, ['test', 'dht11'])),
				gte(schema.entries.temperature, -100) // arduinos are recording -127 temps every once in a while for some reason. Workaround for now.
			)
		)
		.orderBy(asc(schema.entries.source))
		.then((rows) => rows.map((row) => row.source))

	const entriesPromise = db.query.entries.findMany({
		where: (entries, { gte, and, not, inArray, eq }) =>
			and(
				gte(entries.timestamp, startTimestamp),
				not(inArray(entries.source, ['test', 'dht11'])),
				gte(entries.temperature, -100), // arduinos are recording -127 temps every once in a while for some reason. Workaround for now.
				source && source !== 'all' ? eq(entries.source, source) : undefined
			),
		orderBy: (entries, { desc }) => [desc(entries.timestamp)],
	})

	let prevEntriesPromise: Promise<Entry[]> = Promise.resolve([])
	if (showComparison && comparisonStart && comparisonEnd) {
		prevEntriesPromise = db.query.entries.findMany({
			where: (entries, { and, gte, lt, not, inArray, eq }) =>
				and(
					gte(entries.timestamp, comparisonStart),
					lt(entries.timestamp, comparisonEnd),
					not(inArray(entries.source, ['test', 'dht11'])),
					gte(entries.temperature, -100), // arduinos are recording -127 temps every once in a while for some reason. Workaround for now.
					source && source !== 'all' ? eq(entries.source, source) : undefined
				),
			orderBy: (entries, { desc }) => [desc(entries.timestamp)],
		})
	}

	let [sources, entries, prevEntries] = await Promise.all([
		sourcesPromise,
		entriesPromise,
		prevEntriesPromise,
	])

	const decimator = (entries: Entry[]) => {
		const maxEntries = 1500
		if (entries.length <= maxEntries) return entries
		const step = Math.ceil(entries.length / maxEntries)
		return entries.filter((_, i) => i % step === 0)
	}

	entries = decimator(entries)
	prevEntries = decimator(prevEntries)

	return json({ sources, entries, prevEntries })
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

function LatestEntry({
	entries,
	source,
}: {
	entries: Entry[]
	source: string
}) {
	const latestEntry = entries.filter((e) => e.source === source)[0]
	const sourceColor = getSourceColor(source)

	return latestEntry ? (
		<div
			className="w-full lg:w-auto p-5 shadow rounded text-white"
			style={{
				background: `linear-gradient(60deg, ${sourceColor[500]} 60%, ${sourceColor[300]} 100%)`,
			}}
		>
			<div>{tempSourceLabels[source]}</div>
			<div className="text-8xl">{formatNumber(latestEntry.temperature)}°C</div>
			<div>{formatDate(latestEntry.timestamp)}</div>
		</div>
	) : null
}

function Entry({ entry }: { entry: Entry }) {
	return (
		<tr>
			<td>{formatDate(entry.timestamp)}</td>
			<td className="text-right">
				{tempSourceLabels[entry.source as keyof typeof tempSourceLabels]}
			</td>
			<td className="text-right">
				{entry.temperature ? `${formatNumber(entry.temperature)}°C` : null}
			</td>
		</tr>
	)
}

function useReloadOnView() {
	const revalidator = useRevalidator()

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				revalidator.revalidate()
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [revalidator])
}

function EntryChart({
	entries,
	prevEntries,
	timespan,
}: {
	entries: Entry[]
	prevEntries: Entry[]
	timespan: Timespan | null
}) {
	const chartRef = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		let entriesCopy = [...entries]
		entriesCopy = entriesCopy.reverse()
		let prevEntriesCopy = [...prevEntries]
		prevEntriesCopy.reverse()
		prevEntriesCopy = prevEntriesCopy.map((pe) => ({
			...pe,
			timestamp:
				timespan === 'last_hour'
					? addHours(pe.timestamp, 1)
					: timespan === 'last_week'
					? addWeeks(pe.timestamp, 1)
					: addDays(pe.timestamp, 1),
		}))
		let chart = null

		if (chartRef.current) {
			const groupedEntries = groupBy(entriesCopy, 'source')
			const groupedPrevEntries = groupBy(prevEntriesCopy, 'source')

			chart = new Chart(chartRef.current, {
				type: 'line',
				data: {
					datasets: [
						...Object.keys(groupedEntries)
							.toSorted((a, b) => a.localeCompare(b))
							.map((key) => ({
								label: tempSourceLabels[key as keyof typeof tempSourceLabels],
								data: groupedEntries[key],
								borderColor: getSourceColor(key)[400],
								hidden: key === 'dht11' || key === 'test',
							})),
						...Object.keys(groupedPrevEntries).map((key) => ({
							label: `${
								tempSourceLabels[key as keyof typeof tempSourceLabels]
							} (previous period)`,
							data: groupedPrevEntries[key],
							borderColor: getSourceColor(key)[200],
							hidden: key === 'dht11' || key === 'test',
						})),
					],
				},
				options: {
					parsing: {
						xAxisKey: 'timestamp',
						yAxisKey: 'temperature',
					},
					scales: {
						x: {
							type: 'time',
						},
						y: {
							position: 'right',
						},
					},
					elements: {
						point: {
							pointStyle: false,
						},
					},
					maintainAspectRatio: false,
					animation: false,
				},
			})
		}

		return function cleanup() {
			chart?.destroy()
		}
	}, [entries, prevEntries])

	return (
		<div className="h-[400px]">
			<canvas id="entry_chart" ref={chartRef}></canvas>
		</div>
	)
}

function TempHistory({ entries }: { entries: Entry[] }) {
	const [isVisible, setIsVisible] = useState(false)

	return (
		<div className="space-y-5">
			<button
				onClick={() => setIsVisible(!isVisible)}
				className="py-2 rounded-md text-sm hover:underline text-blue-950"
			>
				{isVisible ? 'Hide history' : 'Show history'}
			</button>

			{isVisible ? (
				<div>
					<h2 className="text-2xl">History</h2>
					<table className="w-full">
						<thead>
							<tr>
								<th>Timestamp</th>
								<th className="text-right">Source</th>
								<th className="text-right">Temperature</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((e: Entry) => (
								<Entry entry={e} key={e.id} />
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</div>
	)
}

function Stats({ entries, source }: { entries: Entry[]; source: string }) {
	const sourceEntries = entries.filter((e) => e.source === source)

	if (sourceEntries.length === 0) {
		return null
	}

	const high = maxBy(sourceEntries, 'temperature')
	const low = minBy(sourceEntries, 'temperature')
	const average = meanBy(sourceEntries, 'temperature')

	const sourceColor = getSourceColor(source)

	return (
		<div
			className="p-5 rounded shadow text-white"
			style={{
				background: `linear-gradient(60deg, ${sourceColor[500]} 60%, ${sourceColor[300]} 100%)`,
			}}
		>
			<h3 className="text-lg mb-2">{tempSourceLabels[source]}</h3>
			<div className="flex place-content-between overflow-x-auto w-full gap-16">
				<div>
					<div className="text-sm">High</div>
					<div className="text-5xl">{formatNumber(high.temperature)}°C</div>
					<div className="text-sm">{formatDate(high.timestamp)}</div>
				</div>
				<div>
					<div className="text-sm">Low</div>
					<div className="text-5xl">{formatNumber(low.temperature)}°C</div>
					<div className="text-sm">{formatDate(low.timestamp)}</div>
				</div>
				<div>
					<div className="text-sm">Average</div>
					<div className="text-5xl">{formatNumber(average)}°C</div>
				</div>
			</div>
		</div>
	)
}

export default function Index() {
	const { sources, entries, prevEntries } = useLoaderData<typeof loader>()
	const submit = useSubmit()
	useReloadOnView()
	const [searchParams] = useSearchParams()
	const selectedSource = searchParams.get('stats_source') ?? 'all'
	const selectedTimespan = searchParams.get('timespan') ?? 'last_day'
	const showComparison = searchParams.has('show_comparison')

	return (
		<div className="font-sans p-2 max-w-[500px] lg:max-w-[750px] mx-auto space-y-12">
			<h1 className="text-3xl">Kiwi Temps</h1>
			<div>
				<h2 className="text-2xl mb-5">Trends</h2>
				<Form
					method="GET"
					onChange={(event) => {
						submit(event.currentTarget, { preventScrollReset: true })
					}}
					className="mb-3"
					preventScrollReset
				>
					{selectedSource !== 'all' ? (
						<input type="hidden" name="stats_source" value={selectedSource} />
					) : null}
					<div className="flex gap-5 place-items-center">
						<Select name="timespan" defaultValue={selectedTimespan}>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="last_hour">Last hour</SelectItem>
								<SelectItem value="last_day">Last day</SelectItem>
								<SelectItem value="last_week">Last week</SelectItem>
								<SelectItem value="all">All</SelectItem>
							</SelectContent>
						</Select>
						<div className="flex gap-1 place-items-center">
							<Checkbox
								name="show_comparison"
								id="show_comparison"
								defaultChecked={showComparison}
							/>{' '}
							<Label htmlFor="show_comparison">Show comparisons</Label>
						</div>
					</div>
				</Form>
				<Form
					method="GET"
					onChange={(event) => {
						submit(event.currentTarget, { preventScrollReset: true })
					}}
					className="mb-3"
				>
					{selectedTimespan !== 'last_day' ? (
						<input type="hidden" name="timespan" value={selectedTimespan} />
					) : null}
					{showComparison ? (
						<input type="hidden" name="show_comparison" value="on" />
					) : null}
					<Select name="stats_source" defaultValue={selectedSource}>
						<SelectTrigger className="w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" key="all">
								All sources
							</SelectItem>
							{sources.map((s) => (
								<SelectItem value={s} key={s}>
									{tempSourceLabels[s]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Form>
				<EntryChart
					entries={entries}
					prevEntries={prevEntries}
					timespan={selectedTimespan}
				/>
			</div>
			<div className="space-y-10">
				<h2 className="text-2xl mb-5">Latest temperature</h2>
				<div className="flex gap-x-5 gap-y-10 flex-wrap justify-between">
					{sources.map((s) => (
						<LatestEntry key={s} entries={entries} source={s} />
					))}
				</div>
				<h2 className="text-2xl mb-5">Stats</h2>
				{sources.map((s) => (
					<Stats key={s} entries={entries} source={s} />
				))}
			</div>
			<TempHistory entries={entries} />
		</div>
	)
}
