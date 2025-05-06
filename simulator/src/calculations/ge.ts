import { EnergyData, EnergyMetrics, ProviderStrategy } from "./core";

/**
 * Göteborgs Energi: skiftar 50% av toppN från högsta usage till lägsta usage (inga nattregler).
 */
function optimizeTopNPeaksGE(data: EnergyData[], topN: number = 3): EnergyData[] {
	const optimized = data.map((e) => ({ ...e }));
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
		}
	});

	return optimized;
}

export class GoteborgStrategy implements ProviderStrategy {
	calculateMetrics(data: EnergyData[]): EnergyMetrics {
		const optimized = optimizeTopNPeaksGE(data);
		const totalUsage = data.reduce((sum, e) => sum + e.usage, 0);
		const sorted = [...optimized].sort((a, b) => b.usage - a.usage);
		const originalSorted = [...data].sort((a, b) => b.usage - a.usage);

		const top3Peaks = sorted.slice(0, 3).map((e) => e.usage);
		const originalTop3Peaks = originalSorted.slice(0, 3).map((e) => e.usage);

		const averageTop3 = top3Peaks.reduce((s, v) => s + v, 0) / 3;
		const originalAverageTop3 = originalTop3Peaks.reduce((s, v) => s + v, 0) / 3;

		const powerFee = averageTop3 * 45;
		const originalPowerFee = originalAverageTop3 * 45;

		return {
			totalUsage,
			top3Peaks,
			averageTop3,
			powerFee,
			originalTop3Peaks,
			originalAverageTop3,
			originalPowerFee,
			transfers: null,
			data,
		};
	}
	getTips(): string[] {
		return [
			"Göteborgs Energi rekommenderar att optimera din energiförbrukning.",
			"Minska energianvändningen under högbelastningstimmar för att spara kostnader.",
			"Flytta energikrävande aktiviteter till lågbelastningstimmar.",
			"Övervaka dina energiförbrukningsmönster regelbundet.",
			"Överväg att använda energieffektiva apparater.",
			"Optimera din energianvändning för att sänka effektavgifterna.",
		];
	}
};
