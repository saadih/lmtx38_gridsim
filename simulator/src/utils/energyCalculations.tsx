export const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];

export interface EnergyData {
  timestamp: Date;
  usage: number;
}

/**
 * Parses raw CSV timestamp strings in format D/M/YYYY H:mm or DD/MM/YYYY HH:mm
 * into valid JavaScript Date objects.
 */
export function parseEnergyData(
  rawData: { timestamp: string; usage: number }[]
): EnergyData[] {
  return rawData.map(({ timestamp, usage }) => {
    const parts = timestamp.trim().split(" ");
    if (parts.length !== 2) {
      throw new Error(`Ogiltigt tidsformat, längd är inte av två: ${timestamp}`);
    }
    const [datePart, timePart] = parts;
    const dateElems = datePart.split("-").map(Number);
    const timeElems = timePart.split(":").map(Number);
    if (dateElems.length !== 3 || timeElems.length !== 2) {
      throw new Error(`Ogiltigt tidsformat: ${datePart},${timePart} `);
    }
    const [year, month, day] = dateElems;
    const [hour, minute] = timeElems;
    const dateObj = new Date(year, month - 1, day, hour, minute);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Kunde inte parsa datum: ${timestamp}`);
    }
    return { timestamp: dateObj, usage };
  });
}

// Applicera Ellevio nattregel (justerar kWh för effektavgift)
export function applyEllevioRule(data : EnergyData[] ) {
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
export function optimizeTopNPeaks(data: EnergyData[], topN: number = 3): EnergyData[] {
	const cloned = data.map(entry => ({ 
	  ...entry,
	  consumption: entry.usage }));
	
	console.log("original data sum", data.reduce((sum, e) => sum + e.usage, 0))
	console.log("▶️ Cloned original data:", cloned.slice(0, 5));
  
	// 2) Create adjusted values for peak detection
	const adjusted = applyEllevioRule(cloned).map((entry) => ({
	  ...entry,
	  adjusted: entry.adjusted
	}));
	
	console.log("▶️ Adjusted data with Ellevio rule applied:", adjusted.slice(0, 5));
  
	// 3) Get top N peaks
	const topNPeaks = [...adjusted]
	  .sort((a, b) => b.adjusted - a.adjusted)
	  .slice(0, topN);
	
	console.log("▶️ Top N peaks by adjusted consumption:", topNPeaks.map(p => p.adjusted));
  
	// 4) Process each peak
	topNPeaks.forEach(peak => {
		const peakIndex = cloned.findIndex(e => e.timestamp.getTime() === peak.timestamp.getTime());
		const originalEntry = cloned[peakIndex]
	  
	  let amountToMove = originalEntry.consumption * 0.5;
	  console.log(`▶️ Amount to move for peak at ${originalEntry.timestamp}:`, amountToMove);
  
	  // Get night targets with proper tracking
	  const nightTargets = cloned
		.filter(e => NIGHT_HOURS.includes(e.timestamp.getHours()))
		.sort((a, b) => a.consumption - b.consumption);
  
	  console.log("▶️ Night target candidates:", nightTargets.slice(0, 5));
  
	  // Transfer energy
	  for (const target of nightTargets) {
		if (amountToMove <= 0) break;
		const space = 10 - target.consumption;
		if (space <= 0) continue;
  
		const move = Math.min(space, amountToMove);
		target.consumption += move;
		originalEntry.consumption -= move;
		amountToMove -= move;
		console.log(`▶️ Moving ${move} from peak to target at ${target.timestamp}`);
	  }
	});
  
	console.log("▶️ Final optimized data (after adjustments):", cloned.slice(0, 5));
	
	// Convert back to EnergyData format
	return cloned.map(({ timestamp, consumption }) => ({
	  timestamp,
	  usage: consumption
	}));
  }
  

/**
 * Beräknar total förbrukning, topp3, medeltopp och effektavgift (65 öre/kWh)
 * utifrån redan optimerad data.
 */
export function calculateEnergyMetrics(oldData: EnergyData[] , data: EnergyData[]) {
	const totalUsage = oldData.reduce((sum, e) => sum + e.usage, 0);
	const sorted = [...data].sort((a, b) => b.usage - a.usage);
	const top3Peaks = sorted.slice(0, 3).map((e) => e.usage);
	const averageTop3 = top3Peaks.reduce((s, v) => s + v, 0) / 3;
	const powerFee = averageTop3 * 65; // 0.65 SEK/kWh
	return { totalUsage, top3Peaks, averageTop3, powerFee };
  }
  
  /**
   * Göteborgs Energi: skiftar 50% av toppN från högsta usage till lägsta usage (inga nattregler).
   */
  export function optimizeTopNPeaksGE(
	data: EnergyData[],
	topN: number = 3
  ): EnergyData[] {
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
  
  /**
   * Beräknar total förbrukning, topp3, medeltopp och effektavgift (45 kr/kW)
   * utifrån redan optimerad data.
   */
  export function calculateGeMetrics(data: EnergyData[]) {
	console.log(data)
	const totalUsage = data.reduce((sum, e) => sum + e.usage, 0);
	const sorted = [...data].sort((a, b) => b.usage - a.usage);
	const top3Peaks = sorted.slice(0, 3).map((e) => e.usage);
	const averageTop3 = top3Peaks.reduce((s, v) => s + v, 0) / 3;
	const powerFee = averageTop3 * 45; // Assuming kW and 45 SEK/kW
	return { totalUsage, top3Peaks, averageTop3, powerFee };
  }