import { EnergyData, EnergyMetrics, TransferLog, ProviderStrategy, StrategyTypes } from "./core";

/**
 * Göteborgs Energi: skiftar 50% av toppN från högsta usage till lägsta usage (inga nattregler).
 */
const GE_rate = 45; // SEK/kWh

function optimizeTopNPeaksGE(data: EnergyData[], topN: number = 3): { optimized: EnergyData[]; transfers: TransferLog[] }  {
	const optimized = data.map((e) => ({ ...e }));
	const transfers: TransferLog[] = [];
	const peaks = optimized
		.map((e, i) => ({ index: i, usage: e.usage }))
		.sort((a, b) => b.usage - a.usage)
		.slice(0, topN);

	peaks.forEach(({ index }) => {
		let remaining = optimized[index].usage * 0.5;
		const targets = optimized
			.map((e, i) => ({ index: i, usage: e.usage }))
			.sort((a, b) => a.usage - b.usage);

		for (const t of targets) {
			if (remaining <= 0) break;
			const space = Math.max(10 - optimized[t.index].usage, 0);
			if (space <= 0) continue;
			const move = Math.min(space, remaining);
			optimized[t.index].usage += move;
			optimized[index].usage -= move;
			remaining -= move;

			transfers.push({
				from: new Date(optimized[t.index].timestamp),
				to: new Date(optimized[index].timestamp),
				amount: move
			});
		}
	});

	return {optimized , transfers};
}


export class GoteborgStrategy implements ProviderStrategy {
	strategyType = StrategyTypes.Top3Peak

	calculateMetrics(data: EnergyData[]): EnergyMetrics {
		const optimizedData = optimizeTopNPeaksGE(data);
		const optimized = optimizedData.optimized;
		const totalUsage = data.reduce((sum, e) => sum + e.usage, 0);
		const sorted = [...optimized].sort((a, b) => b.usage - a.usage);
		const originalSorted = [...data].sort((a, b) => b.usage - a.usage);

		const top3Peaks = sorted.slice(0, 3).map((e) => e.usage);
		const originalTop3Peaks = originalSorted.slice(0, 3).map((e) => e.usage);

		const averageTop3 = top3Peaks.reduce((s, v) => s + v, 0) / 3;
		const originalAverageTop3 = originalTop3Peaks.reduce((s, v) => s + v, 0) / 3;

		const powerFee = averageTop3 * GE_rate;
		const originalPowerFee = originalAverageTop3 * GE_rate;

		return {
			totalUsage,
			top3Peaks,
			averageTop3,
			powerFee,
			originalTop3Peaks,
			originalAverageTop3,
			originalPowerFee,
			transfers: optimizedData.transfers,
			data,
			rate: GE_rate
		};
	}
	applyRule(data: EnergyData[]): { timestamp: Date; usage: number }[] {
		// GE has no night‐rule, so it’s a no-op
		return data.map(({ timestamp, usage }) => ({ timestamp, usage }));
	  }
	getTips(): string[] {
		return [
			"Undvik att köra flera tunga laster (tvätt, disk, spis, ladda elbil) samtidigt för att sprida ut topparna.",
			"Schemalägg tunga laster till olika dagar eller mellantider med timers eller smartplugs.",
			"Välj korta och energieffektiva program på dina vitvaror för att hålla effektuttagen låga.",
			"Logga in på Mitt Göteborg Energi och övervaka dina månadstoppar",
			"Sänk inomhustemperaturen 1-2 °C när du riskerar toppeffekter och använd smart termostat med veckoprogram.",
			"Koppla ur standby-apparater och dra nytta av av-/på-grenuttag för att eliminera dolda laster.",
			"Se över isolering och täta fönster/dörrar så att värmesystemet arbetar jämnare utan onödiga effekttoppar.",
			"https://www.goteborgenergi.se/privat/elnat/elnatsavgiften#effekt",
		];
	}
};
