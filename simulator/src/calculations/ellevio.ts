import {EnergyMetrics, EnergyData, ProviderStrategy } from "./core";

const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];

// Applicera Ellevio nattregel (justerar kWh för effektavgift)
function applyEllevioRule(data : EnergyData[] ) {
	return data.map(({ timestamp, usage }) => {
	  const hour = timestamp.getHours();
	  const isNight = NIGHT_HOURS.includes(hour);
	  const adjusted = isNight ? usage / 2 : usage;
	  return { timestamp, adjusted };
	});
  }

/**
 * Skiftar 50% av de topN största förbrukningstopparna till nattimmar med lägst usage.
 */
interface TransferLog {
	from: Date;
	to: Date;
	amount: number;
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
	calculateMetrics(oldData: EnergyData[]): EnergyMetrics {
		const optimizedNPeaks = optimizeTopNPeaks(oldData)
		const data = applyEllevioRule(optimizedNPeaks.optimized)
		.map(({ timestamp, adjusted }) => ({
		  timestamp,
		  usage: adjusted,
		}));
		
		const totalUsage = oldData.reduce((sum, e) => sum + e.usage, 0);
	
		const sorted = [...data].sort((a, b) => b.usage - a.usage);
		const originalSorted = applyEllevioRule(oldData)
		.map(({ timestamp, adjusted }) => ({ timestamp, usage: adjusted }))
		.sort((a, b) => b.usage - a.usage);
		
		const top3Peaks = sorted.slice(0, 3).map((e) => e.usage);
		const originalTop3Peaks = originalSorted.slice(0, 3).map((e) => e.usage);

		const averageTop3 = top3Peaks.reduce((s, v) => s + v, 0) / 3;
		const originalAverageTop3 = originalTop3Peaks.reduce((s, v) => s + v, 0) / 3;
	
		const powerFee = averageTop3 * 65; // 0.65 SEK/kWhs
		const originalPowerFee = originalAverageTop3 * 65

		const transfers = optimizedNPeaks.transfers
		console.log(transfers);
		return {
			totalUsage,
			top3Peaks,
			averageTop3,
			powerFee,
			originalTop3Peaks,
			originalAverageTop3,
			originalPowerFee,
			transfers,
			data,
		};
	}
}