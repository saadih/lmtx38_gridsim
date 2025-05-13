import {EnergyMetrics, EnergyData, TransferLog, ProviderStrategy, StrategyTypes } from "./core";

const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];
const Ellevio_rate = 81.25; // SEK/kWh


// Applicera Ellevio nattregel (justerar kWh för effektavgift)
function applyEllevioRule(data : EnergyData[] ) {
	return data.map(({ timestamp, usage }) => {
	  const hour = timestamp.getHours();
	  const isNight = NIGHT_HOURS.includes(hour);
	  const adjusted = isNight ? usage / 2 : usage;
	  return { timestamp, adjusted };
	});
}
function optimizeTopNPeaks(
	data: EnergyData[],
	topN: number = 3
): { optimized: EnergyData[]; transfers: TransferLog[] } {
	const cloned = data.map(entry => ({ 
		...entry,
		consumption: entry.usage 
	}));

	const adjusted = applyEllevioRule(cloned).map((entry) => ({
		...entry,
		adjusted: entry.adjusted
	}));

	const topNPeaks = [...adjusted]
		.sort((a, b) => b.adjusted - a.adjusted)
		.slice(0, topN);

	const transfers: TransferLog[] = [];

	topNPeaks.forEach(peak => {
		const peakIndex = cloned.findIndex(e => e.timestamp.getTime() === peak.timestamp.getTime());
		const originalEntry = cloned[peakIndex];

		let amountToMove = originalEntry.consumption * 0.5;

		const nightTargets = cloned
			.filter(e => NIGHT_HOURS.includes(e.timestamp.getHours()))
			.sort((a, b) => a.consumption - b.consumption);

		for (const target of nightTargets) {
			if (amountToMove <= 0) break;

			const space = 10 - target.consumption;
			if (space <= 0) continue;

			const move = Math.min(space, amountToMove);
			target.consumption += move;
			originalEntry.consumption -= move;
			amountToMove -= move;

			transfers.push({
				from: new Date(originalEntry.timestamp),
				to: new Date(target.timestamp),
				amount: move
			});
		}
	});

	const optimized = cloned.map(({ timestamp, consumption }) => ({
		timestamp,
		usage: consumption
	}));

	return { optimized, transfers };
}
  
export class EllevioStrategy implements ProviderStrategy {
	strategyType = StrategyTypes.Top3Peak

	calculateMetrics(oldData: EnergyData[]): EnergyMetrics {
	  // 1) Redistribute raw usage (no halving yet)
	  const { optimized: rawOptimized, transfers } = optimizeTopNPeaks(oldData);
	  const adjustedData = applyEllevioRule(rawOptimized)
	  .map(({ timestamp, adjusted }) => ({ timestamp, usage: adjusted }));
	  
	  // 2) Apply night-rule only for billing
	  const billedOptimized = applyEllevioRule(rawOptimized);
	  const billedOriginal = applyEllevioRule(oldData);
  
	  // 3) Top-3 after optimization & night-rule
	  const top3Peaks = [...billedOptimized]
		.sort((a, b) => b.adjusted - a.adjusted)
		.slice(0, 3)
		.map(e => e.adjusted);
  
	  // 4) Top-3 of original before optimization but with night-rule
	  const originalTop3Peaks = [...billedOriginal]
		.sort((a, b) => b.adjusted - a.adjusted)
		.slice(0, 3)
		.map(e => e.adjusted);
  
	  // 5) Averages & fees
	  const averageTop3 = top3Peaks.reduce((s, v) => s + v, 0) / 3;
	  const originalAverageTop3 = originalTop3Peaks.reduce((s, v) => s + v, 0) / 3;
	  const powerFee = averageTop3 * Ellevio_rate;
	  const originalPowerFee = originalAverageTop3 * Ellevio_rate;
  
	  // 6) Total usage remains sum of raw input
	  const totalUsage = oldData.reduce((s, e) => s + e.usage, 0);
  
	  return {
		totalUsage,
		top3Peaks,
		averageTop3,
		powerFee,
		originalTop3Peaks,
		originalAverageTop3,
		originalPowerFee,
		transfers,
		data: rawOptimized,
		adjustedData,
		rate: Ellevio_rate
	  };
	}
	applyRule(data: EnergyData[]): { timestamp: Date; usage: number }[] {
		// This is your old applyEllevioRule, but returning timestamp + usage
		return data.map(({ timestamp, usage }) => {
		  const isNight = NIGHT_HOURS.includes(timestamp.getHours());
		  return { timestamp, usage: isNight ? usage / 2 : usage };
		});
	}
	getTips(): string[] {
		return [
			"Flytta energiförbrukning till nattetid enligt optimeringen för att minska din effektavgift.",
			"Identifiera och minimera perioder med hög förbrukning.",
			"Schemalägg tunga laster (tvätt, disk) till lågprisperioder.",
			"Investera i energieffektiva vitvaror och LED-belysning.",
			"Sänk värmen med 1-2 °C och ventilera kort men effektivt.",
			"Koppla ur standby-apparater och använd smarta timers.",
			"Följ förbrukningen i realtid med en energimonitor.",
			"https://www.ellevio.se/abonnemang/ny-prismodell-baserad-pa-effekt/#h-sa-kan-du-sanka-dina-effekttoppar"
		];
	}
	getNightHours() {
		return NIGHT_HOURS;
	}
}