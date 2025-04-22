// energyCalculations.ts

const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];

export interface EnergyData {
  timestamp: Date;
  usage: number; // kWh
}

// Helper to check if a date is during night hours
function isNightTime(timestamp: Date): boolean {
  const hour = timestamp.getHours();
  return NIGHT_HOURS.includes(hour);
}

/**
 * Applies Ellevio's night time rule (night hours count as half consumption for fee calculation)
 */
function applyEllevioRule(data: EnergyData[]): { timestamp: Date; adjustedUsage: number }[] {
  return data.map(({ timestamp, usage }) => ({
    timestamp,
    adjustedUsage: isNightTime(timestamp) ? usage / 2 : usage
  }));
}

/**
 * Optimizes energy usage by shifting consumption from peak hours to night hours
 */
export function optimizeTopNPeaks(data: EnergyData[], topN: number = 3): EnergyData[] {
  // Create a deep copy of the data to avoid mutating the original
  const optimizedData = data.map(entry => ({ ...entry }));
  
  // Get adjusted usage for peak detection
  const adjustedData = applyEllevioRule(optimizedData);
  
  // Find the top N peaks (based on adjusted usage)
  const topPeaks = [...adjustedData]
    .sort((a, b) => b.adjustedUsage - a.adjustedUsage)
    .slice(0, topN);
  
  // For each peak, shift 50% of consumption to night hours
  topPeaks.forEach(peak => {
    const peakEntry = optimizedData.find(e => 
      e.timestamp.getTime() === peak.timestamp.getTime()
    )!;
    
    let amountToShift = peakEntry.usage * 0.5; // Shift 50% of peak usage
    
    // Find available night time slots (sorted by lowest usage first)
    const nightSlots = optimizedData
      .filter(e => isNightTime(e.timestamp))
      .sort((a, b) => a.usage - b.usage);
    
    // Distribute the shifted usage to night slots
    for (const slot of nightSlots) {
      if (amountToShift <= 0) break;
      
      const availableCapacity = 10 - slot.usage; // Assuming 10 kWh max per slot
      if (availableCapacity <= 0) continue;
      
      const shiftAmount = Math.min(availableCapacity, amountToShift);
      slot.usage += shiftAmount;
      peakEntry.usage -= shiftAmount;
      amountToShift -= shiftAmount;
    }
  });
  
  return optimizedData;
}

/**
 * Calculates all required energy metrics
 */
// energyCalculations.ts (updated)
export function calculateEnergyMetrics(data: EnergyData[]) {
    // First optimize the data
    const optimizedData = optimizeTopNPeaks(data);
  
    // 1. Total Consumption remains unchanged (sum of original data)
    const totalUsage = data.reduce((sum, entry) => sum + entry.usage, 0);
    
    // 2. Get top 3 peaks from OPTIMIZED data
    const top3Peaks = [...optimizedData]
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 3)
      .map(entry => entry.usage);
  
    // 3. Average of optimized top 3 peaks
    const averageTop3 = top3Peaks.reduce((sum, val) => sum + val, 0) / 3;
    
    // 4. Power fee calculation using optimized and adjusted data
    const adjustedData = applyEllevioRule(optimizedData);
    const totalAdjustedUsage = adjustedData.reduce((sum, entry) => sum + entry.adjustedUsage, 0);
    const powerFee = totalAdjustedUsage * 0.6;
  
    return {
      totalUsage,
      top3Peaks,
      averageTop3,
      powerFee
    };
}

// Utility function to convert string timestamps to Date objects
export function parseEnergyData(rawData: { timestamp: string; usage: number }[]): EnergyData[] {
  return rawData.map(entry => ({
    timestamp: new Date(entry.timestamp),
    usage: entry.usage
  }));
}