import {
	json,
	type MetaFunction,
	type LoaderFunctionArgs,
} from '@remix-run/node'
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
	useNavigate,
	Form,
	useSubmit,
	useLocation,
	useSearchParams,
} from '@remix-run/react'
import { useEffect, useRef } from 'react'
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

type Timespan = 'last_week' | 'last_day' | 'last_hour' | 'all'

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

	const entriesPromise = db.query.entries.findMany({
		where: (entries, { gte, and, sql, not, inArray }) => {
			const commonPart = and(
				gte(entries.timestamp, startTimestamp),
				not(inArray(entries.source, ['test', 'dht11']))
			)
			return timespan === 'all'
				? and(
						inArray(sql`strftime('%M', timestamp)`, [
							'56',
							'57',
							'58',
							'59',
							'00',
						]),
						commonPart
				  )
				: commonPart
		},
		orderBy: (entries, { desc }) => [desc(entries.timestamp)],
	})

	let prevEntriesPromise: Promise<Entry[]> = Promise.resolve([])
	if (showComparison && comparisonStart && comparisonEnd) {
		prevEntriesPromise = db.query.entries.findMany({
			where: (entries, { and, gte, lt, not, inArray }) =>
				and(
					gte(entries.timestamp, comparisonStart),
					lt(entries.timestamp, comparisonEnd),
					not(inArray(entries.source, ['test', 'dht11']))
				),
			orderBy: (entries, { desc }) => [desc(entries.timestamp)],
		})
	}

	const [entries, prevEntries] = await Promise.all([
		entriesPromise,
		prevEntriesPromise,
	])

	return json({ entries, prevEntries })
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
	const latestFrontRoomEntry = entries.filter((e) => e.source === source)[0]
	return (
		<div className="flex place-content-around">
			<div>
				<div>Current temperature</div>
				<div className="text-8xl">
					{formatNumber(latestFrontRoomEntry.temperature)}°C
				</div>
				<div>{formatDate(latestFrontRoomEntry.timestamp)}</div>
			</div>
		</div>
	)
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
	const navigate = useNavigate()
	const location = useLocation()

	useEffect(() => {
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) {
				navigate(`.${location.search}`, {
					replace: true,
					preventScrollReset: true,
				})
			}
		})
	}, [location.search, navigate])
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
		entries.reverse()
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
			const groupedEntries = groupBy(entries, 'source')
			const groupedPrevEntries = groupBy(prevEntriesCopy, 'source')

			chart = new Chart(chartRef.current, {
				type: 'line',
				data: {
					datasets: [
						...Object.keys(groupedEntries).map((key) => ({
							label: tempSourceLabels[key as keyof typeof tempSourceLabels],
							data: groupedEntries[key],
							borderColor:
								key === 'front_room'
									? tailwindColors.sky[400]
									: key === 'master_bedroom'
									? tailwindColors.emerald[400]
									: key === 'back_room'
									? tailwindColors.violet[400]
									: key === 'spare_bedroom'
									? tailwindColors.amber[400]
									: tailwindColors.stone[200],
							hidden: key === 'dht11' || key === 'test',
						})),
						...Object.keys(groupedPrevEntries).map((key) => ({
							label: `${
								tempSourceLabels[key as keyof typeof tempSourceLabels]
							} (previous period)`,
							data: groupedPrevEntries[key],
							borderColor:
								key === 'front_room'
									? tailwindColors.sky[200]
									: key === 'master_bedroom'
									? tailwindColors.emerald[200]
									: key === 'back_room'
									? tailwindColors.violet[200]
									: key === 'spare_bedroom'
									? tailwindColors.amber[200]
									: tailwindColors.stone[200],
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
	return (
		<table className="w-full">
			<thead>
				<tr>
					<th>Timestamp</th>
					<th className="text-right">Source</th>
					<th className="text-right">Temperature</th>
				</tr>
			</thead>
			{entries.map((e: Entry) => (
				<Entry entry={e} key={e.id} />
			))}
		</table>
	)
}

function Stats({ entries, source }: { entries: Entry[]; source: string }) {
	const frontRoomEntries = entries.filter((e) => e.source === source)
	const high = maxBy(frontRoomEntries, 'temperature')
	const low = minBy(frontRoomEntries, 'temperature')
	const average = meanBy(frontRoomEntries, 'temperature')

	return (
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
	)
}

export default function Index() {
	const { entries, prevEntries } = useLoaderData<typeof loader>()
	const submit = useSubmit()
	useReloadOnView()
	const [searchParams] = useSearchParams()
	const sources = [...new Set(entries.map((e) => e.source))]
	const selectedSource = searchParams.get('stats_source') ?? 'front_room'
	const selectedTimespan = searchParams.get('timespan') ?? 'last_day'
	const showComparison = searchParams.get('show_comparison')

	return (
		<div className="font-sans p-4 max-w-[500px] lg:max-w-[750px] mx-auto space-y-12">
			<h1 className="text-3xl">Haultain Temps</h1>
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
					{selectedSource !== 'front_room' ? (
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
							<Checkbox name="show_comparison" id="show_comparison" />{' '}
							<Label htmlFor="show_comparison">Show comparisons</Label>
						</div>
					</div>
				</Form>
				<EntryChart
					entries={entries}
					prevEntries={prevEntries}
					timespan={selectedTimespan}
				/>
			</div>
			<div className="space-y-5">
				<h2 className="text-2xl mb-5">Stats</h2>
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
							{sources.map((s) => (
								<SelectItem value={s} key={s}>
									{tempSourceLabels[s]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Form>
				<LatestEntry entries={entries} source={selectedSource} />
				<Stats entries={entries} source={selectedSource} />
			</div>
			<div>
				<h2 className="text-2xl mb-5">History</h2>
				<TempHistory entries={entries} />
			</div>
		</div>
	)
}
