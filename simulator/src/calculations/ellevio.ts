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
function optimizeTopNPeaks(data: EnergyData[], topN: number = 3): EnergyData[] {
	const cloned = data.map(entry => ({ 
	  ...entry,
	  consumption: entry.usage }));
	
	console.log("original data sum", data.reduce((sum, e) => sum + e.usage, 0))
	console.log("Cloned original data:", cloned.slice(0, 5));
  
	// 2) Create adjusted values for peak detection
	const adjusted = applyEllevioRule(cloned).map((entry) => ({
	  ...entry,
	  adjusted: entry.adjusted
	}));
	
	console.log("Adjusted data with Ellevio rule applied:", adjusted.slice(0, 5));
  
	// 3) Get top N peaks
	const topNPeaks = [...adjusted]
	  .sort((a, b) => b.adjusted - a.adjusted)
	  .slice(0, topN);
	
	console.log("Top N peaks by adjusted consumption:", topNPeaks.map(p => p.adjusted));
  
	// 4) Process each peak
	topNPeaks.forEach(peak => {
		const peakIndex = cloned.findIndex(e => e.timestamp.getTime() === peak.timestamp.getTime());
		const originalEntry = cloned[peakIndex]
	  
	  let amountToMove = originalEntry.consumption * 0.5;
	  console.log(`Amount to move for peak at ${originalEntry.timestamp}:`, amountToMove);
  
	  // Get night targets with proper tracking
	  const nightTargets = cloned
		.filter(e => NIGHT_HOURS.includes(e.timestamp.getHours()))
		.sort((a, b) => a.consumption - b.consumption);
  
	  console.log("Night target candidates:", nightTargets.slice(0, 5));
  
	  // Transfer energy
	  for (const target of nightTargets) {
		if (amountToMove <= 0) break;
		const space = 10 - target.consumption;
		if (space <= 0) continue;
  
		const move = Math.min(space, amountToMove);
		target.consumption += move;
		originalEntry.consumption -= move;
		amountToMove -= move;
		console.log(`Moving ${move} from peak to target at ${target.timestamp}`);
	  }
	});
  
	console.log("Final optimized data (after adjustments):", cloned.slice(0, 5));
	
	// Convert back to EnergyData format
	return cloned.map(({ timestamp, consumption }) => ({
	  timestamp,
	  usage: consumption
	}));
  }
  
export class EllevioStrategy implements ProviderStrategy {
	calculateMetrics(oldData: EnergyData[]): EnergyMetrics {
		const data = applyEllevioRule(optimizeTopNPeaks(oldData))
		.map(({ timestamp, adjusted }) => ({
		  timestamp,
		  usage: adjusted,
		}));
		
		const totalUsage = oldData.reduce((sum, e) => sum + e.usage, 0);
	
		const sorted = [...data].sort((a, b) => b.usage - a.usage);
		const originalsorted = applyEllevioRule(oldData)
		.map(({ timestamp, adjusted }) => ({ timestamp, usage: adjusted }))
		.sort((a, b) => b.usage - a.usage);
		
		const top3Peaks = sorted.slice(0, 3).map((e) => e.usage);
		const originalTop3Peaks = originalsorted.slice(0, 3).map((e) => e.usage);
	
		const averageTop3 = top3Peaks.reduce((s, v) => s + v, 0) / 3;
		const originalAverageTop3 = originalTop3Peaks.reduce((s, v) => s + v, 0) / 3;
	
		const powerFee = averageTop3 * 65; // 0.65 SEK/kWh
		const originalPowerFee = originalAverageTop3 * 65
		return {
			totalUsage,
			top3Peaks,
			averageTop3,
			powerFee,
			originalTop3Peaks,
			originalAverageTop3,
			originalPowerFee,
			data,
		};
	}
}