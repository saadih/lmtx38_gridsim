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

    // raw‐consumption as “adjusted” so we can run it through the same display fn:
    const rawAsAdjustedGE = original.map(({ timestamp, consumption }) => ({
      timestamp,
      adjusted: consumption
    }));


    // --- Ellevio variants ---
    const targeted            = optimizeTop3ForEllevio(original);
    const top5                = optimizeTop5ForEllevio(original);
    const top7                = optimizeTop7ForEllevio(original);
    const flattened           = flattenForEllevio(original);
    const peakShaved          = peakShavingSlidingWindow(original, 5, 1.1);
    const valleyFilled        = valleyFilling(original, 0.2);
    const dailyRedistributed  = dailyRedistribution(original);
    const smoothed            = consumptionSmoothing(original, 5, 0.1);

    const adjustedOriginal            = applyEllevioRule(original);
    const adjustedTargeted            = applyEllevioRule(targeted);
    const adjustedTop5                = applyEllevioRule(top5);
    const adjustedTop7                = applyEllevioRule(top7);
    const adjustedFlattened           = applyEllevioRule(flattened);
    const adjustedPeakShaved          = applyEllevioRule(peakShaved);
    const adjustedValleyFilled        = applyEllevioRule(valleyFilled);
    const adjustedDailyRedistributed  = applyEllevioRule(dailyRedistributed);
    const adjustedSmoothed            = applyEllevioRule(smoothed);
    // --- Göteborgs Energi variants ---
    const geTop3 = optimizeTop3ForGoteborgs(original);
    const geTop5 = optimizeTop5ForGoteborgs(original);
    const geTop7 = optimizeTop7ForGoteborgs(original);
    const gePeak   = peakShavingForGoteborgs(original, 5, 1.1);
    const geValley = valleyFillingForGoteborgs(original, 0.2);
    const geDaily  = dailyRedistributionForGoteborgs(original);
    const geSmooth = consumptionSmoothingForGoteborgs(original, 5, 0.1);

    const adjGeOrig   = applyGoteborgsRule(original);
    const adjGeTop3   = applyGoteborgsRule(geTop3);
    const adjGeTop5   = applyGoteborgsRule(geTop5);
    const adjGeTop7   = applyGoteborgsRule(geTop7);
    const adjGePeak   = applyGoteborgsRule(gePeak);
    const adjGeValley = applyGoteborgsRule(geValley);
    const adjGeDaily  = applyGoteborgsRule(geDaily);
    const adjGeSmooth = applyGoteborgsRule(geSmooth);
  
    displayAllSummaries(
      // Ellevio (9)
      adjustedOriginal,            original,
      adjustedTargeted,            targeted,
      adjustedTop5,                top5,
      adjustedTop7,                top7,
      adjustedPeakShaved,          peakShaved,
      adjustedValleyFilled,        valleyFilled,
      adjustedDailyRedistributed,  dailyRedistributed,
      adjustedSmoothed,            smoothed,

      // GE före optimering 
      rawAsAdjustedGE, original,

      adjGeTop3,   geTop3,
      adjGeTop5,   geTop5,
      adjGeTop7,   geTop7,
      adjGePeak,   gePeak,
      adjGeValley, geValley,
      adjGeDaily,  geDaily,
      adjGeSmooth, geSmooth
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
	console.log("▶️ Cloned original data:", cloned.slice(0, 5)); // Log cloned data
  
	const adjusted = applyEllevioRule(cloned).map((entry, i) => ({
	  ...cloned[i],
	  adjusted: entry.adjusted,
	}));
	console.log("▶️ Adjusted data with Ellevio rule applied:", adjusted.slice(0, 5)); // Log adjusted data
  
	// Pick the topN peaks by adjusted consumption.
	const topNPeaks = [...adjusted]
		.sort((a, b) => b.adjusted - a.adjusted)
		.slice(0, topN);

	console.log("▶️ Top N peaks by adjusted consumption:", topNPeaks.map(p => p.adjusted)); // Log topN peaks
  
	topNPeaks.forEach(peak => {
	  const peakIndex = cloned.findIndex(e => e.timestamp.getTime() === peak.timestamp.getTime());
	  const originalEntry = cloned[peakIndex];

	  let amountToMove = originalEntry.consumption * 0.5; // Reduce 50% of peak consumption
	  console.log(`▶️ Amount to move for peak at ${originalEntry.timestamp}:`, amountToMove);
  
	  // Identify candidates in night hours sorted by low consumption.
	  const nightTargets = cloned
		.filter(e => NIGHT_HOURS.includes(e.timestamp.getHours()))
		.sort((a, b) => a.consumption - b.consumption);
		
	  console.log("▶️ Night target candidates:", nightTargets.slice(0, 5)); // Log night target candidates
  
	  for (let target of nightTargets) {
		if (amountToMove <= 0) break;
		const space = 10 - target.consumption; // assume a max capacity per slot of 10 kWh.
		if (space <= 0) continue;

		const move = Math.min(space, amountToMove);
		target.consumption += move;
		originalEntry.consumption -= move;
		amountToMove -= move;
		console.log(`▶️ Moving ${move} from peak to target at ${target.timestamp}`);
	  }
	});
  
	console.log("▶️ Final optimized data (after adjustments):", cloned.slice(0, 5)); // Log final data
	return cloned;
  }
  
function optimizeTop3ForEllevio(data) { return optimizeTopNForEllevio(data, 3); }
function optimizeTop5ForEllevio(data) { return optimizeTopNForEllevio(data, 3); }
function optimizeTop7ForEllevio(data) { return optimizeTopNForEllevio(data, 3); }

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


// Display Summaries for All Optimizations
//
// This function prints a summary for each method including total consumption,
// the top 3 adjusted (Ellevio rule applied) values, the average of the top 3, and the computed fee.
// -------------------------
function applyGoteborgsRule(data) {
  return data.map(({timestamp,consumption})=>({ timestamp, adjusted: consumption }));
}

function optimizeTopNForGoteborgs(data, topN) {
  const c = data.map(e=>({ ...e }));
  const peaks = [...c].sort((a,b)=>b.consumption - a.consumption).slice(0,topN);
  peaks.forEach(p=>{
    const i = c.findIndex(e=>e.timestamp.getTime()===p.timestamp.getTime());
    let move = c[i].consumption * 0.5;
    const targ = [...c].sort((a,b)=>a.consumption - b.consumption);
    targ.forEach(t=>{
      if (!move) return;
      const space = 10 - t.consumption;
      const m     = Math.min(space, move);
      if (m>0){
        t.consumption    += m;
        c[i].consumption -= m;
        move            -= m;
      }
    });
  });
  return c;
}
const optimizeTop3ForGoteborgs = d=>optimizeTopNForGoteborgs(d,3);
const optimizeTop5ForGoteborgs = d=>optimizeTopNForGoteborgs(d,5);
const optimizeTop7ForGoteborgs = d=>optimizeTopNForGoteborgs(d,7);

function flattenForGoteborgs(data) {
  const total = data.reduce((s,e)=>s+e.consumption,0);
  const per   = total/data.length;
  return data.map(e=>({ timestamp: e.timestamp, consumption: per }));
}

function peakShavingForGoteborgs(data, windowSize=5, thresholdFactor=1.1) {
  const c    = data.map(e=>({ ...e }));
  const half = Math.floor(windowSize/2);
  for (let i=half;i<c.length-half;i++){
    let sum=0,ct=0;
    for (let j=i-half;j<=i+half;j++){
      if(j===i)continue;
      sum+=c[j].consumption;ct++;
    }
    const avg=sum/ct;
    if(c[i].consumption>avg*thresholdFactor){
      const reduce=(c[i].consumption-avg)*0.5;
      c[i].consumption-=reduce;
      const per=reduce/ct;
      for(let j=i-half;j<=i+half;j++){
        if(j===i)continue;
        c[j].consumption+=per;
      }
    }
  }
  return c;
}

function valleyFillingForGoteborgs(data, transferFactor=0.2) {
  const c = data.map(e=>({ ...e }));
  const valleys = c.slice().sort((a,b)=>a.consumption-b.consumption);
  valleys.forEach(v=>{
    let iter=0;
    while(iter<50){
      const peak=c.reduce((m,e)=>e.consumption>m.consumption?e:m,c[0]);
      if(peak.consumption<=v.consumption)break;
      const amt=Math.min(peak.consumption*transferFactor,10-v.consumption);
      if(amt<=0)break;
      v.consumption    += amt;
      peak.consumption -= amt;
      iter++;
    }
  });
  return c;
}

const dailyRedistributionForGoteborgs  = dailyRedistribution;
const consumptionSmoothingForGoteborgs = consumptionSmoothing;

// -------------------------
// Unified Display
// -------------------------
function displayAllSummaries(...entries) {
  const fmt = v => v.toFixed(2).replace('.', ',');
  const labels = [
    // Ellevio (65 kr)
    "FÖRE OPTIMERING",
    "EFTER OPTIMERING (TOPP 3 REDUKTION)",
    "EFTER OPTIMERING (TOPP 5 REDUKTION)",
    "EFTER OPTIMERING (TOPP 7 REDUKTION)",
    "EFTER OPTIMERING (PEAK SHAVING)",
    "EFTER OPTIMERING (VALLEY FILLING)",
    "EFTER OPTIMERING (DAGLIG OMBALANSERING)",
    "EFTER OPTIMERING (SMOOTHING)",
    // GE (45 kr)
    "GE - FÖRE OPTIMERING",
    "GE - EFTER OPTIMERING (TOPP 3 REDUKTION)",
    "GE - EFTER OPTIMERING (TOPP 5 REDUKTION)",
    "GE - EFTER OPTIMERING (TOPP 7 REDUKTION)",
    "GE - EFTER OPTIMERING (PEAK SHAVING)",
    "GE - EFTER OPTIMERING (VALLEY FILLING)",
    "GE - EFTER OPTIMERING (DAGLIG OMBALANSERING)",
    "GE - EFTER OPTIMERING (SMOOTHING)"
  ];
  const rates = [...Array(8).fill(65), ...Array(8).fill(45)];

  let out = "";
  for (let i = 0; i < entries.length; i += 2) {
    const idx      = i/2;
    const adjusted = entries[i];
    const raw      = entries[i+1];
    const rate     = rates[idx];

    const total = raw.reduce((s,x)=>s+x.consumption,0);

    const top3 = [...adjusted]
      .sort((a,b)=>b.adjusted - a.adjusted)
      .slice(0,3)
      .map(e=>fmt(e.adjusted));

	  console.log(labels[idx],[...adjusted].sort((a,b)=>b.adjusted - a.adjusted));
    const avg = top3
      .map(v=>parseFloat(v.replace(',','.')))
      .reduce((s,n)=>s+n,0)/3;

    const fee = avg * rate;

    out += `${labels[idx]}\n`;
    out += `  Total förbrukning: ${fmt(total)} kWh\n`;
    out += `  Topp 3: ${top3.join(', ')}\n`;
    out += `  Medeltopp: ${fmt(avg)} kW\n`;
    out += `  Effektavgift: ${fmt(fee)} kr\n\n`;
  }

  document.getElementById("output").textContent = out;
}