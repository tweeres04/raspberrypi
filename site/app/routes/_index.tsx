import {
	json,
	type MetaFunction,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { and, asc, gte, inArray, not } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import 'chartjs-adapter-date-fns'
import { CaretSortIcon } from '@radix-ui/react-icons'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
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
	useNavigation,
} from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import {
	addDays,
	addHours,
	addMonths,
	addWeeks,
	formatDistanceToNow,
	subDays,
	subHours,
	subMonths,
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
		: source === 'carport'
		? tailwindColors.gray
		: tailwindColors.stone
}

type Timespan =
	| 'last_month'
	| 'last_week'
	| 'last_day'
	| 'last_twelve_hours'
	| 'last_hour'
	| 'all'

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
	const selectedSources = url.searchParams
		.getAll('stats_source')
		.filter((s) => s !== 'all')
	const showComparison = url.searchParams.has('show_comparison')
	const now = new Date()

	const [startTimestamp, comparisonStart, comparisonEnd] =
		timespan === 'last_hour'
			? [subHours(now, 1), subHours(now, 2), subHours(now, 1)].map((d) =>
					d.toISOString()
			  )
			: timespan === 'last_twelve_hours'
			? [subHours(now, 12), subHours(now, 24), subHours(now, 12)].map((d) =>
					d.toISOString()
			  )
			: timespan === 'last_week'
			? [subWeeks(now, 1), subWeeks(now, 2), subWeeks(now, 1)].map((d) =>
					d.toISOString()
			  )
			: timespan === 'last_month'
			? [subMonths(now, 1), subMonths(now, 2), subMonths(now, 1)].map((d) =>
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
		where: (entries, { gte, and, not, inArray }) =>
			and(
				gte(entries.timestamp, startTimestamp),
				not(inArray(entries.source, ['test', 'dht11'])),
				gte(entries.temperature, -100), // arduinos are recording -127 temps every once in a while for some reason. Workaround for now.
				selectedSources.length > 0
					? inArray(entries.source, selectedSources)
					: undefined
			),
		orderBy: (entries, { desc }) => [desc(entries.timestamp)],
	})

	let prevEntriesPromise: Promise<Entry[]> = Promise.resolve([])
	if (showComparison && comparisonStart && comparisonEnd) {
		prevEntriesPromise = db.query.entries.findMany({
			where: (entries, { and, gte, lt, not, inArray }) =>
				and(
					gte(entries.timestamp, comparisonStart),
					lt(entries.timestamp, comparisonEnd),
					not(inArray(entries.source, ['test', 'dht11'])),
					gte(entries.temperature, -100), // arduinos are recording -127 temps every once in a while for some reason. Workaround for now.
					selectedSources.length > 0
						? inArray(entries.source, selectedSources)
						: undefined
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
	showLabel = true,
}: {
	entries: Entry[]
	source: string
	showLabel?: boolean
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
			{showLabel ? <div>{tempSourceLabels[source]}</div> : null}
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
			if (document.visibilityState === 'visible') {
				revalidator.revalidate()
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)

		const intervalId = setInterval(() => {
			if (document.visibilityState === 'visible') {
				revalidator.revalidate()
			}
		}, 5 * 60 * 1000)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			clearInterval(intervalId)
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
					: timespan === 'last_twelve_hours'
					? addHours(pe.timestamp, 12)
					: timespan === 'last_week'
					? addWeeks(pe.timestamp, 1)
					: timespan === 'last_month'
					? addMonths(pe.timestamp, 1)
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

function Stats({
	entries,
	source,
	showLabel = true,
}: {
	entries: Entry[]
	source: string
	showLabel?: boolean
}) {
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
			{showLabel ? (
				<h3 className="text-lg mb-2">{tempSourceLabels[source]}</h3>
			) : null}
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

function StatusIndicator({ latestEntry }: { latestEntry: Entry }) {
	const revalidator = useRevalidator()
	const navigation = useNavigation()

	const isLoading =
		revalidator.state === 'loading' || navigation.state === 'loading'

	return (
		<button
			className="text-sm"
			onClick={() => revalidator.revalidate()}
			disabled={isLoading}
		>
			{isLoading ? (
				<>Loading...</>
			) : (
				<>
					<div className="text-xs">Latest entry</div>
					<div>{formatDistanceToNow(latestEntry.timestamp)} ago</div>
				</>
			)}
		</button>
	)
}

function SourcesSelect({
	sources,
	selectedSources,
	onSourcesChange,
}: {
	sources: string[]
	selectedSources: string[]
	onSourcesChange: (sources: string[]) => void
}) {
	const label =
		selectedSources.length === 0
			? 'All sources'
			: selectedSources.length === 1
			? tempSourceLabels[selectedSources[0] as keyof typeof tempSourceLabels]
			: `${selectedSources.length} sources`

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex h-9 w-full lg:w-48 items-center justify-between whitespace-nowrap rounded-md border border-stone-200 bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-stone-950">
				<span className="line-clamp-1">{label}</span>
				<CaretSortIcon className="h-4 w-4 opacity-50" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[--radix-popper-anchor-width]">
				<DropdownMenuCheckboxItem
					checked={selectedSources.length === 0}
					onSelect={(event) => event.preventDefault()}
					onCheckedChange={() => onSourcesChange([])}
				>
					All sources
				</DropdownMenuCheckboxItem>
				<DropdownMenuSeparator />
				{sources.map((s) => (
					<DropdownMenuCheckboxItem
						key={s}
						checked={selectedSources.includes(s)}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={(checked) =>
							onSourcesChange(
								checked
									? [...selectedSources, s]
									: selectedSources.filter((selected) => selected !== s)
							)
						}
					>
						{tempSourceLabels[s as keyof typeof tempSourceLabels]}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default function Index() {
	const { sources, entries, prevEntries } = useLoaderData<typeof loader>()
	const submit = useSubmit()
	useReloadOnView()
	const [searchParams] = useSearchParams()
	const selectedSources = searchParams
		.getAll('stats_source')
		.filter((s) => s !== 'all')
	const selectedTimespan = searchParams.get('timespan') ?? 'last_day'
	const showComparison = searchParams.has('show_comparison')
	const formRef = useRef<HTMLFormElement>(null)

	function handleSourcesChange(nextSources: string[]) {
		if (!formRef.current) return

		const formData = new FormData(formRef.current)
		formData.delete('stats_source')
		nextSources.forEach((s) => {
			formData.append('stats_source', s)
		})

		submit(formData, { method: 'GET', preventScrollReset: true })
	}

	return (
		<div className="font-sans p-2 max-w-[500px] lg:max-w-[750px] mx-auto space-y-12">
			<h1 className="text-3xl flex place-items-center">
				<span className="flex-grow">🥝 Kiwi Temps</span>
				<StatusIndicator latestEntry={entries[0]} />
			</h1>
			<div className="space-y-5">
				<h2 className="text-2xl">Trends</h2>
				<Form
					method="GET"
					ref={formRef}
					onChange={(event) => {
						submit(event.currentTarget, { preventScrollReset: true })
					}}
					className="mb-3"
					preventScrollReset
				>
					<div className="flex-col flex lg:flex-row gap-5 place-items-center">
						<Select name="timespan" defaultValue={selectedTimespan}>
							<SelectTrigger className="lg:w-48">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="last_hour">Last hour</SelectItem>
								<SelectItem value="last_twelve_hours">
									Last 12 hours
								</SelectItem>
								<SelectItem value="last_day">Last day</SelectItem>
								<SelectItem value="last_week">Last week</SelectItem>
								<SelectItem value="last_month">Last month</SelectItem>
								<SelectItem value="all">All</SelectItem>
							</SelectContent>
						</Select>
						{selectedSources.map((s) => (
							<input key={s} type="hidden" name="stats_source" value={s} />
						))}
						<SourcesSelect
							sources={sources}
							selectedSources={selectedSources}
							onSourcesChange={handleSourcesChange}
						/>
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
						<LatestEntry
							key={s}
							entries={entries}
							source={s}
							showLabel={selectedSources.length !== 1}
						/>
					))}
				</div>
				<h2 className="text-2xl mb-5">Stats</h2>
				{sources.map((s) => (
					<Stats
						key={s}
						entries={entries}
						source={s}
						showLabel={selectedSources.length !== 1}
					/>
				))}
			</div>
			<TempHistory entries={entries} />
		</div>
	)
}
