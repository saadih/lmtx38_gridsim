const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];

// -------------------------
// File Input Event Listener
// -------------------------
document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const raw = event.target.result;
    const original = parseCsv(raw);

    // Existing Top-N optimizations using peak reductions
    const targeted = optimizeTop3ForEllevio(original);
    const top5 = optimizeTop5ForEllevio(original);
    const top7 = optimizeTop7ForEllevio(original);

    // Linear (weighted) redistribution optimization
    const flattened = flattenForEllevio(original);

    // Updated Peak Shaving using a sliding window with adjustable parameters:
    const peakShaved = peakShavingSlidingWindow(original, 5, 1.1);

    // Updated Valley Filling: Iteratively transfers energy from current global peaks into valleys.
    const valleyFilled = valleyFilling(original, 0.2);

    // -------------------------
    // New Optimization Methods
    // -------------------------
    // Daily Redistribution: Balances consumption within each day.
    const dailyRedistributed = dailyRedistribution(original);


    // Consumption Smoothing: Nudges consumption values toward a moving-average baseline.
    const smoothed = consumptionSmoothing(original, 5, 0.1); // 5-sample window; 10% nudge

    // Apply the Ellevio night rule to all variants (night hours count as half)
    const adjustedOriginal = applyEllevioRule(original);
    const adjustedTargeted = applyEllevioRule(targeted);
    const adjustedTop5 = applyEllevioRule(top5);
    const adjustedTop7 = applyEllevioRule(top7);
    const adjustedFlattened = applyEllevioRule(flattened);
    const adjustedPeakShaved = applyEllevioRule(peakShaved);
    const adjustedValleyFilled = applyEllevioRule(valleyFilled);
    const adjustedDailyRedistributed = applyEllevioRule(dailyRedistributed);
    const adjustedSmoothed = applyEllevioRule(smoothed);

    displayAllSummaries(
      adjustedOriginal, original,
      adjustedTargeted, targeted,
      adjustedTop5, top5,
      adjustedTop7, top7,
      adjustedFlattened, flattened,
      adjustedPeakShaved, peakShaved,
      adjustedValleyFilled, valleyFilled,
      adjustedDailyRedistributed, dailyRedistributed,
      adjustedSmoothed, smoothed
    );
  };
  reader.readAsText(file);
});

// -------------------------
// CSV Parsing Function
// -------------------------
function parseCsv(raw) {
  const lines = raw.trim().split("\n");
  // Remove empty lines and commented lines (starting with #)
  const filtered = lines.filter(line => line.trim() !== "" && !line.startsWith("#"));
  const dataLines = filtered.slice(1); // Assume first line is header

  return dataLines
    .map(line => {
      const [timestampStr, rawConsumption] = line.split(/\t|;/);
      if (!timestampStr || !rawConsumption) return null;
      const timestamp = new Date(timestampStr.trim());
      const consumption = parseFloat(rawConsumption.trim().replace(",", "."));
      if (isNaN(timestamp.getTime()) || isNaN(consumption)) return null;
      return { timestamp, consumption };
    })
    .filter(x => x !== null);
}

// -------------------------
// Apply Ellevio Rule: Adjust consumption based on night hours
// Night hours count as half consumption for fee calculation.
// -------------------------
function applyEllevioRule(data) {
  return data.map(({ timestamp, consumption }) => {
    const hour = timestamp.getHours();
    const isNight = NIGHT_HOURS.includes(hour);
    const adjusted = isNight ? consumption / 2 : consumption;
    return { timestamp, adjusted };
  });
}

// -------------------------
// Method 1: Top-N Optimization: Reduce peaks by shifting energy from the top N entries.
// -------------------------
function optimizeTopNForEllevio(data, topN) {
  const cloned = data.map(entry => ({ ...entry }));
  const adjusted = applyEllevioRule(cloned).map((entry, i) => ({
    ...cloned[i],
    adjusted: entry.adjusted,
  }));

  // Pick the topN peaks by adjusted consumption.
  const topNPeaks = [...adjusted].sort((a, b) => b.adjusted - a.adjusted).slice(0, topN);

  topNPeaks.forEach(peak => {
    const peakIndex = cloned.findIndex(e => e.timestamp.getTime() === peak.timestamp.getTime());
    const originalEntry = cloned[peakIndex];
    let amountToMove = originalEntry.consumption * 0.5; // Reduce 50% of peak consumption

    // Identify candidates in night hours sorted by low consumption.
    const nightTargets = cloned
      .filter(e => NIGHT_HOURS.includes(e.timestamp.getHours()))
      .sort((a, b) => a.consumption - b.consumption);

    for (let target of nightTargets) {
      if (amountToMove <= 0) break;
      const space = 10 - target.consumption; // assume a max capacity per slot of 10 kWh.
      if (space <= 0) continue;
      const move = Math.min(space, amountToMove);
      target.consumption += move;
      originalEntry.consumption -= move;
      amountToMove -= move;
    }
  });

  return cloned;
}
function optimizeTop3ForEllevio(data) { return optimizeTopNForEllevio(data, 3); }
function optimizeTop5ForEllevio(data) { return optimizeTopNForEllevio(data, 5); }
function optimizeTop7ForEllevio(data) { return optimizeTopNForEllevio(data, 7); }

// -------------------------
// Method 2: Flattening (Linear Redistribution)
// Redistributes total consumption linearly based on weighted slot preferences (night hours weighted higher).
// -------------------------
function flattenForEllevio(data) {
  const totalKwh = data.reduce((sum, x) => sum + x.consumption, 0);

  const weightedSlots = data.map(entry => {
    const hour = entry.timestamp.getHours();
    const isNight = NIGHT_HOURS.includes(hour);
    const weight = isNight ? 2 : 1; // Favor night hours.
    return { ...entry, weight };
  });

  const totalWeight = weightedSlots.reduce((sum, x) => sum + x.weight, 0);
  const kwhPerWeight = totalKwh / totalWeight;

  return weightedSlots.map(entry => ({
    timestamp: entry.timestamp,
    consumption: entry.weight * kwhPerWeight
  }));
}

// -------------------------
// Method 3: Peak Shaving using a Sliding Window
//
// Parameters:
// - windowSize: number of entries in the window (default 5)
// - thresholdFactor: factor by which current consumption must exceed the local average to be considered a peak (default 1.1)
// -------------------------
function peakShavingSlidingWindow(data, windowSize = 5, thresholdFactor = 1.1) {
  const cloned = data.map(entry => ({ ...entry }));
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = halfWindow; i < cloned.length - halfWindow; i++) {
    let sum = 0, count = 0;
    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (j === i) continue; // skip the current entry
      sum += cloned[j].consumption;
      count++;
    }
    const localAvg = sum / count;

    if (cloned[i].consumption > localAvg * thresholdFactor) {
      const diff = cloned[i].consumption - localAvg;
      const reduce = diff * 0.5; // Remove half the excess consumption.
      cloned[i].consumption -= reduce;

      // Find neighbors in the window that are in night hours.
      const receivers = [];
      for (let j = i - halfWindow; j <= i + halfWindow; j++) {
        if (j === i) continue;
        if (NIGHT_HOURS.includes(cloned[j].timestamp.getHours())) {
          receivers.push(j);
        }
      }
      if (receivers.length > 0) {
        const portion = reduce / receivers.length;
        receivers.forEach(j => {
          cloned[j].consumption += portion;
        });
      } else {
        // If no receiver qualifies, restore the removed consumption.
        cloned[i].consumption += reduce;
      }
    }
  }
  return cloned;
}

// -------------------------
// Method 4: Valley Filling
//
// Iteratively transfers a percentage (transferFactor) of the current peak's consumption to valley slots,
// but only if the valley occurs during a night hour and has available capacity (max 10 kWh).
//
// Parameters:
// - transferFactor: fraction of the current peak's consumption that is transferable (default 0.2)
// -------------------------
function valleyFilling(data, transferFactor = 0.2) {
  const cloned = data.map(entry => ({ ...entry }));

  // Identify candidate valleys (only during night hours).
  const valleyCandidates = cloned.filter(entry => NIGHT_HOURS.includes(entry.timestamp.getHours()));

  valleyCandidates.forEach(valley => {
    // Continue transferring until the valley is nearly full (10 kWh)
    let iterations = 0;
    while (valley.consumption < 10 && iterations < 50) { // Iteration limit to prevent infinite loop.
      // Recompute current global peak.
      const peak = cloned.reduce((max, cur) => cur.consumption > max.consumption ? cur : max, cloned[0]);
      if (peak.consumption <= valley.consumption) break; // No available energy to transfer.

      const transferable = Math.min(peak.consumption * transferFactor, 10 - valley.consumption);
      if (transferable <= 0) break;
      valley.consumption += transferable;
      peak.consumption -= transferable;
      iterations++;
    }
  });
  return cloned;
}

// -------------------------
// Method 5: Daily Redistribution (Daglig ombalansering)
// Groups data by date and redistributes consumption within each day so all slots get closer to the daily average,
// while ensuring no slot exceeds 10 kWh.
// -------------------------
function dailyRedistribution(data) {
  const cloned = data.map(entry => ({ ...entry }));
  const groups = {};

  // Group by date (YYYY-MM-DD)
  cloned.forEach(entry => {
    const dateStr = entry.timestamp.toISOString().split("T")[0];
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(entry);
  });

  Object.values(groups).forEach(dayGroup => {
    const total = dayGroup.reduce((sum, entry) => sum + entry.consumption, 0);
    const target = total / dayGroup.length; // Average consumption per slot for the day.

    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < dayGroup.length; i++) {
        for (let j = 0; j < dayGroup.length; j++) {
          if (i === j) continue;
          if (dayGroup[i].consumption > target && dayGroup[j].consumption < target) {
            const excess = dayGroup[i].consumption - target;
            const deficit = target - dayGroup[j].consumption;
            const transferable = Math.min(excess, deficit, 10 - dayGroup[j].consumption);
            if (transferable > 0) {
              dayGroup[i].consumption -= transferable;
              dayGroup[j].consumption += transferable;
              changed = true;
            }
          }
        }
      }
    }
  });
  return cloned;
}

// -------------------------
// Method 6: Consumption Smoothing
//
// Applies a moving average filter over a window (windowSize) and then nudges each entry's consumption
// a fraction (nudgeFactor) toward the local average. This soft smoothing helps reduce abrupt peaks.
// -------------------------
function consumptionSmoothing(data, windowSize = 5, nudgeFactor = 0.1) {
  const cloned = data.map(entry => ({ ...entry }));
  const len = cloned.length;
  const smoothed = [];

  // Compute the moving average for each entry.
  for (let i = 0; i < len; i++) {
    let sum = 0, count = 0;
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(len, i + Math.ceil(windowSize / 2));
    for (let j = start; j < end; j++) {
      sum += cloned[j].consumption;
      count++;
    }
    smoothed.push(sum / count);
  }

  // Record the original total consumption.
  const originalTotal = data.reduce((sum, entry) => sum + entry.consumption, 0);

  // Nudge each entry toward its smoothed average.
  for (let i = 0; i < len; i++) {
    const diff = smoothed[i] - cloned[i].consumption;
    cloned[i].consumption += diff * nudgeFactor;
  }

  // Compute the new total and adjust each entry to preserve the original total.
  const newTotal = cloned.reduce((sum, entry) => sum + entry.consumption, 0);
  const ratio = originalTotal / newTotal;
  for (let i = 0; i < len; i++) {
    cloned[i].consumption *= ratio;
  }

  return cloned;
}

// -------------------------
// Display Summaries for All Optimizations
//
// This function prints a summary for each method including total consumption,
// the top 3 adjusted (Ellevio rule applied) values, the average of the top 3, and the computed fee.
// -------------------------
function displayAllSummaries(...entries) {
  const format = v => v.toFixed(2).replace('.', ',');

  const labels = [
    "FÖRE OPTIMERING",
    "EFTER OPTIMERING (TOPP 3 REDUKTION)",
    "EFTER OPTIMERING (TOPP 5 REDUKTION)",
    "EFTER OPTIMERING (TOPP 7 REDUKTION)",
    "EFTER OPTIMERING (LINJÄR FÖRDELNING)",
    "EFTER OPTIMERING (PEAK SHAVING)",
    "EFTER OPTIMERING (VALLEY FILLING)",
    "EFTER OPTIMERING (DAGLIG OMBALANSERING)",
    "EFTER OPTIMERING (SMOOTHING)",
  ];

  let output = "";
  for (let i = 0; i < entries.length; i += 2) {
    const adjusted = entries[i];
    const raw = entries[i + 1];
    // Sort by adjusted consumption in descending order.
    const sorted = [...adjusted].sort((a, b) => b.adjusted - a.adjusted);
    const top3 = sorted.slice(0, 3);
    const avg = top3.reduce((sum, x) => sum + x.adjusted, 0) / 3;
    const fee = avg * 65; // Assuming fee is computed as average adjusted (kW) times 65.
    const total = raw.reduce((sum, x) => sum + x.consumption, 0);

    output += `${labels[i / 2]}\n`;
    output += `Total förbrukning: ${format(total)} kWh\n`;
    output += `Topp 3 justerade: ${top3.map(e => format(e.adjusted)).join(', ')}\n`;
    output += `Medeltopp: ${format(avg)} kW\n`;
    output += `Effektavgift: ${format(fee)} kr\n\n`;
  }

  document.getElementById("output").textContent = output;
}
