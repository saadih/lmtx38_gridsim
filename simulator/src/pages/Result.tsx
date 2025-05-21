import React, { useState } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ReferenceLine,
	ResponsiveContainer,
	Legend,
	Area,
} from "recharts";
import { getProviderStrategy, EnergyMetrics, EnergyData } from "../calculations/core";
import { Sun, Moon } from "lucide-react";
interface ResultProps {
	data: EnergyData[];
	provider: string;
}

const Result: React.FC<ResultProps> = ({ data, provider }) => {
	const [isMaximized, setIsMaximized] = useState(false); // State for toggling chart size
	const strategy = getProviderStrategy(provider);
	const metrics: EnergyMetrics = strategy.calculateMetrics(data)
	const tips: string[] = strategy.getTips();

	const originalSeries = strategy
		.applyRule(data)
		.map(({ timestamp, usage }) => ({
			timestamp: timestamp.getTime(),
			usage,
		}));

	const optimizedSeries = strategy
		.applyRule(metrics.data)
		.map(({ timestamp, usage }) => ({
			timestamp: timestamp.getTime(),
			usage,
		}));

	// Construct combinedSeries
	const combinedSeries = originalSeries.map((original, index) => ({
		timestamp: original.timestamp,
		usageBefore: original.usage,
		usageAfter: optimizedSeries[index] ? optimizedSeries[index].usage : null,
	}));
	const originalTop3 = [...originalSeries]
		.sort((a, b) => b.usage - a.usage)
		.slice(0, 3)
		.map((p) => p.timestamp);
	const afterTop3 = [...optimizedSeries]
		.sort((a, b) => b.usage - a.usage)
		.slice(0, 3)
		.map((p) => p.timestamp);

	const originalSet = new Set(originalTop3);
	const afterSet = new Set(afterTop3);

	const ICON_SIZE = 20;
	const ICON_VERTICAL_OFFSET = 20;  // lift icon above the dot
	const DOT_RADIUS = 4;            // size of the peak-dot
	const makePeakDot =
	(peakSet: Set<number>, strokeColor: string, Icon: React.FC<{size:number; color?:string;}>) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		({ cx, cy, payload }: any) => {
	  // only render on top-3 timestamps
	  if (!peakSet.has(payload.timestamp)) return <g />;
  
	  return (
		<g>
		  {/* the colored dot */}
		  <circle
			cx={cx}
			cy={cy}
			r={DOT_RADIUS}
			fill={strokeColor}
			stroke="white"
			strokeWidth={1}
		  />
		  {/* the icon just above */}
		  <g
			transform={`
			  translate(
				${cx - ICON_SIZE / 2},
				${cy - ICON_SIZE / 2 - ICON_VERTICAL_OFFSET}
			  )
			`}
		  >
			<Icon size={ICON_SIZE} color={strokeColor} />
		  </g>
		</g>
	  );
	};
	// Formatter som visar dag/månad och timme/minut
	const formatDateTime = (ms: number) =>
		new Date(ms).toLocaleString("sv-SE", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});

	const changePercentage = calculateChangePercentage(
  		metrics.originalPowerFee || 0, metrics.powerFee);
	return (
		<div className="space-y-8">
			<header className="space-y-2">
				<h2 className="text-2xl font-bold text-gray-800">Optimeringsresultat</h2>
				<p className="text-gray-600">
					Optimeringsmetod : {strategy.strategyType}
				</p>
			</header>

			{strategy.additionalInformation && (
				<header className="space-y-2">
					<h2 className="text-2xl font-bold text-gray-800">Observera</h2>
					<p className="text-gray-600">
						{strategy.additionalInformation.split(" ").map((word, index) =>
							word.startsWith("http") ? (
								<a
									key={index}
									href={word}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:underline"
								>
									{word}
								</a>
							) : (
								`${word} `
							)
						)}
					</p>
				</header>
			)}

			<section className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<MetricCard
					title="Total Förbrukning"
					value={`${metrics.totalUsage.toFixed(2)} kWh`}
				/>
				<MetricCard
					title="Medeltopp (Efter optimering)"
					value={
						<>
							<span>{metrics.averageTop3.toFixed(2)} kW</span>
							<span className="block text-sm text-gray-500">
								(Före: {metrics.originalAverageTop3?.toFixed(2)} kW)
							</span>
						</>
					}
					changePercentage={calculateChangePercentage(
						metrics.originalAverageTop3 || 0,
						metrics.averageTop3
					)}
				/>
				<div className="md:col-span-2">
					<MetricCard
						title="Topp 3 Förbrukningstoppar"
						value={
							<ul className="space-y-2 mb-2">
								{metrics.top3Peaks.map((peak, i) => (
									<li key={i} className="flex justify-between">
										<span>Topp {i + 1}:</span>
										<div className="flex items-center">
											<span className="text-gray-500 text-sm line-through mr-2">
												{metrics.originalTop3Peaks?.[i].toFixed(2)} kW
											</span>
											<span className="font-medium">
												{peak.toFixed(2)} kW
											</span>
											<span className="ml-2 text-sm text-green-600">
												↓{calculateChangePercentage(
													metrics.originalTop3Peaks?.[i] || 0,
													peak
												)}
											</span>
										</div>
									</li>
								))}
							</ul>
						}
						description={
							provider === "Ellevio"
								? "* 50% av topparna har flyttats till natttimmar"
								: undefined
						}
					/>

				</div>
				{metrics.transfers && metrics.transfers.length > 0 && (
					<div className="md:col-span-2">
						<div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
							<h3 className="text-lg font-semibold text-yellow-800 mb-2">Så här fungerade optimeringen</h3>
							<p className="text-sm text-yellow-900 mb-2">
								För att minska topparna har energi flyttats från högbelastade timmar till tider på natten med lägre förbrukning. Detta resulterade i en jämnare förbrukning och lägre effektavgifter.
							</p>
							<ul className="list-disc list-inside text-sm text-yellow-900 space-y-1">
								{metrics.transfers.map((t, i) => {
									const pad = (n: number) => n.toString().padStart(2, '0');
									const format = (d: Date) =>
										`${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:00`;
									return (
										<li key={i}>
											{t.amount.toFixed(2)} kW flyttades från {format(t.from)} till {format(t.to)}.
										</li>
									);
								})}
							</ul>
						</div>
					</div>
				)}
				{/* Blåa boxar: Effektavgift + Pris per kW */}
				<section className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* Box 1: Effektavgift */}
					<div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
						<h4 className="text-sm font-medium text-gray-800 mb-1">
							Effektavgift (Efter optimering)
						</h4>
						<div className="text-2xl font-bold text-blue-600">
							{metrics.powerFee.toFixed(2)} SEK
						</div>
						<div className="text-sm text-gray-700">
							(Före: {metrics.originalPowerFee?.toFixed(2)} SEK)
						</div>
						{changePercentage && (
							<div
								className={`
								mt-1 text-sm
								${parseFloat(changePercentage) < 0 ? "text-green-600" : "text-red-600"}
								`}
							>
								{parseFloat(changePercentage) < 0 ? "Besparing " : "Ökning "}
								{changePercentage.replace("-", "")}
							</div>	
						)}
					</div>

					{/* Box 2: Pris per kW */}
					<div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
						<h4 className="text-sm font-medium text-gray-800 mb-1">
							Pris per kW
						</h4>
						<div className="text-2xl font-bold text-blue-600">
							{metrics.rate.toFixed(2)} SEK
						</div>
						{provider === "Ellevio" && (
							<div className="text-sm text-gray-700 mt-1">
								Halverad nattförbrukning 22-06
							</div>
						)}
					</div>
				</section>
			</section>
			{/* Tips-ruta för att minska effekttoppar */}
			<section className="mt-6">
				<div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
					<h3 className="text-lg font-semibold mb-2">Tips för att minska effekttoppar</h3>
					<ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
						{tips.map((tip, i) => (
							<li key={i}>
								{tip.startsWith("http") ? (
									<a href={tip} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
										{tip}
									</a>
								) : (
									tip
								)}
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="grid grid-cols-1 gap-6">
				{/* Före och Efter optimering */}
				<div className={`p-4 border rounded-lg bg-white ${isMaximized ? "fixed inset-0 z-50 m-0 p-4 bg-white" : "relative"}`}>
					<div className="flex justify-between items-center mb-4">
						<h3 className="text-lg font-semibold">Före och efter optimering</h3>
						<button
							onClick={() => setIsMaximized(!isMaximized)}
							className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
						>
							{isMaximized ? "Minimera" : "Maximera"}
						</button>
					</div>
					<div className={isMaximized ? "h-[calc(100vh-100px)]" : "h-[500px]"}>
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={combinedSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									dataKey="timestamp"
									type="number"
									scale="time"
									domain={["auto", "auto"]}
									tick={false}
								/>
								<YAxis unit=" kW" />
								<Tooltip
									labelFormatter={formatDateTime}
									formatter={(value: number) => `${value.toFixed(2)} kW`}
								/>
								<Legend verticalAlign="top" height={36} />

								<ReferenceLine
									y={metrics.originalAverageTop3}
									stroke="rgba(60, 179, 113, 1)"
									strokeDasharray="3 3"
									label={{
										value: `Avg Topp 3 Före: ${(metrics.originalAverageTop3 ?? 0).toFixed(2)} kW`,
										position: "top",
										fill: "rgba(60, 179, 113, 1)",
										fontSize: 12,
									}}
								/>
								<ReferenceLine
									y={metrics.averageTop3}
									stroke="rgba(255, 99, 71, 1)"
									strokeDasharray="3 3"
									label={{
										value: `Avg Topp 3 Efter: ${metrics.averageTop3.toFixed(2)} kW`,
										position: "top",
										fill: "rgba(255, 99, 71, 1)",
										fontSize: 12,
									}}
								/>
								<Area
									type="monotone"
									dataKey="usageBefore"
									stroke="none"
									fill="rgba(255, 99, 71, 0.2)"
									isAnimationActive={false}
									activeDot={false}
								/>
								<Area
									type="monotone"
									dataKey="usageAfter"
									stroke="none"
									fill="rgba(60, 179, 113, 0.2)"
									isAnimationActive={false}
									activeDot={false}
								/>

								{/* “Före” line with custom dots on the top 3 points */}
								<Line
									dataKey="usageBefore"
									stroke="#009E73"
									strokeWidth={2}
									dot={makePeakDot(originalSet, "#009E73", Sun)}
									name="Före"
								/>
								<Line
									dataKey="usageAfter"
									stroke="#D55E00"
									strokeWidth={2}
									dot={makePeakDot(afterSet,  "#D55E00", Moon)}
									name="Efter"
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>
			</section>
		</div>
	);
};

const MetricCard: React.FC<{
	title: string;
	value: React.ReactNode;
	description?: string;
	highlight?: boolean;
	changePercentage?: string;
}> = ({ title, value, description, highlight = false, changePercentage }) => (
	<div className={`p-4 rounded-lg border ${highlight ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
		<h3 className="text-sm font-medium text-gray-600">{title}</h3>
		<div className={`mt-1 text-2xl ${highlight ? "font-bold text-blue-600" : "font-semibold text-gray-800"}`}>{value}</div>
		{changePercentage && (
			<div className={`mt-1 text-sm ${parseFloat(changePercentage) < 0 ? "text-green-600" : "text-red-600"}`}>
				{parseFloat(changePercentage) < 0 ? "Besparing " : "Ökning "}
				{changePercentage.replace("-", "")}
			</div>
		)}
		{description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
	</div>
);

function calculateChangePercentage(original: number, optimized: number): string {
	if (original === 0) return "0%";
	const change = ((optimized - original) / original) * 100;
	return `${change.toFixed(1)}%`;
}

export default Result;
