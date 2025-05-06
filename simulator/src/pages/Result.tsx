import React from "react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	CartesianGrid,
} from "recharts";
import { getProviderStrategy, EnergyMetrics, EnergyData } from "../calculations/core";

interface ResultProps {
	data: EnergyData[];
	provider: "Ellevio" | "GE";
}

const Result: React.FC<ResultProps> = ({ data, provider }) => {
	const strategy = getProviderStrategy(provider);

	const metrics: EnergyMetrics = strategy.calculateMetrics(data)
	const tips: string[] = strategy.getTips();

	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<h2 className="text-2xl font-bold text-gray-800">Optimering Resultat</h2>
				<p className="text-gray-600">
					Effektiviserad energiförbrukning med topplastoptimering
				</p>
			</header>

			<section className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<MetricCard
					title="Total Förbrukning"
					value={`${metrics.totalUsage.toFixed(2)} kWh`}
					description="Totalförbrukning förändras inte vid optimering"
				/>
				<MetricCard
					title="Medeltopp (Efter optimering)"
					value={
						<>
							<span>{metrics.averageTop3.toFixed(2)} kWh</span>
							<span className="block text-sm text-gray-500">
								(Före: {metrics.originalAverageTop3?.toFixed(2)} kWh)
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
												{metrics.originalTop3Peaks?.[i].toFixed(2)} kWh
											</span>
											<span className="font-medium">
												{peak.toFixed(2)} kWh
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
								? "* 50% av topparna har flyttats till natttimmar enligt Ellevio"
								: undefined
						}
					/>

				</div>
				{metrics.transfers && metrics.transfers.length > 0 && (
					<div className="md:col-span-2">
						<div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
							<h3 className="text-sm font-semibold text-yellow-800 mb-2">Så här fungerade optimeringen</h3>
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
											{t.amount.toFixed(2)} kWh flyttades från {format(t.from)} till {format(t.to)}.
										</li>
									);
								})}
							</ul>
						</div>
					</div>
				)}

				<MetricCard
					title="Effektavgift (Efter optimering)"
					value={
						<>
							<span>{metrics.powerFee.toFixed(2)} SEK</span>
							<span className="block text-sm text-gray-500">
								(Före: {metrics.originalPowerFee?.toFixed(2)} SEK)
							</span>
						</>
					}
					highlight
					changePercentage={calculateChangePercentage(
						metrics.originalPowerFee || 0,
						metrics.powerFee
					)}
				/>
			</section>
				{/* Tips-ruta för att minska effekttoppar */}
				<section className="mt-6">
					<div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
					<h3 className="text-lg font-semibold mb-2">Tips för att minska effekttoppar</h3>
					<ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
						{tips.map((tip, i) => (
						<li key={i}>{tip}</li>
						))}
					</ul>
					</div>
				</section>

			{/* Column Chart */}
			<section className="mt-6">
				<h3 className="text-lg font-semibold mb-2">Optimerad Förbrukning (Graf)</h3>
				<div className="h-64">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={metrics.data}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
							<YAxis unit=" kWh" />
							<Tooltip formatter={(value: number) => [`${value.toFixed(2)} kWh`, "Förbrukning"]} />
							<Bar dataKey="usage" fill="#3B82F6" />
						</BarChart>
					</ResponsiveContainer>
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
