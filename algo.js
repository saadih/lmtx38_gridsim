const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5];

document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const raw = event.target.result;
    const original = parseCsv(raw);
    const targeted = optimizeTop3ForEllevio(original);
    const flattened = flattenForEllevio(original);

    const adjustedOriginal = applyEllevioRule(original);
    const adjustedTargeted = applyEllevioRule(targeted);
    const adjustedFlattened = applyEllevioRule(flattened);

    displayAllSummaries(
      adjustedOriginal, original,
      adjustedTargeted, targeted,
      adjustedFlattened, flattened
    );
  };
  reader.readAsText(file);
});

function parseCsv(raw) {
  const lines = raw.trim().split("\n");
  const filtered = lines.filter((line) => line.trim() !== "" && !line.startsWith("#"));
  const dataLines = filtered.slice(1);

  return dataLines
    .map((line) => {
      const [timestampStr, rawConsumption] = line.split(/\t|;/);
      if (!timestampStr || !rawConsumption) return null;
      const timestamp = new Date(timestampStr.trim());
      const consumption = parseFloat(rawConsumption.trim().replace(",", "."));
      if (isNaN(timestamp.getTime()) || isNaN(consumption)) return null;
      return { timestamp, consumption };
    })
    .filter((x) => x !== null);
}

function applyEllevioRule(data) {
  return data.map(({ timestamp, consumption }) => {
    const hour = timestamp.getHours();
    const isNight = NIGHT_HOURS.includes(hour);
    const adjusted = isNight ? consumption / 2 : consumption;
    return { timestamp, adjusted };
  });
}

function optimizeTop3ForEllevio(data) {
  const cloned = data.map((entry) => ({ ...entry }));

  const adjusted = applyEllevioRule(cloned).map((entry, i) => ({
    ...cloned[i],
    adjusted: entry.adjusted,
  }));

  const top3 = [...adjusted].sort((a, b) => b.adjusted - a.adjusted).slice(0, 3);

  for (const peak of top3) {
    const peakIndex = cloned.findIndex(
      (e) => e.timestamp.getTime() === peak.timestamp.getTime()
    );
    const originalEntry = cloned[peakIndex];
    let amountToMove = originalEntry.consumption * 0.5;

    const nightTargets = cloned
      .filter((e) => NIGHT_HOURS.includes(e.timestamp.getHours()))
      .sort((a, b) => a.consumption - b.consumption);

    for (const target of nightTargets) {
      if (amountToMove <= 0) break;
      const space = 10 - target.consumption;
      if (space <= 0) continue;
      const move = Math.min(space, amountToMove);
      target.consumption += move;
      originalEntry.consumption -= move;
      amountToMove -= move;
    }
  }

  return cloned;
}
function flattenForEllevio(data) {
  const totalKwh = data.reduce((sum, x) => sum + x.consumption, 0);

  const weightedSlots = data.map(entry => {
    const hour = entry.timestamp.getHours();
    const isNight = NIGHT_HOURS.includes(hour);
    const weight = isNight ? 2 : 1; // YES — night gets weight 2
    return { ...entry, weight };
  });

  const totalWeight = weightedSlots.reduce((sum, x) => sum + x.weight, 0);
  const kwhPerWeight = totalKwh / totalWeight;

  return weightedSlots.map(entry => {
    const newConsumption = entry.weight * kwhPerWeight;
    return {
      timestamp: entry.timestamp,
      consumption: newConsumption
    };
  });
}



function top3Info(adjustedData, rawData) {
  const sorted = [...adjustedData].sort((a, b) => b.adjusted - a.adjusted);
  const top3 = sorted.slice(0, 3);
  const avg = top3.reduce((sum, x) => sum + x.adjusted, 0) / 3;
  const fee = avg * 65;
  const total = rawData.reduce((sum, x) => sum + x.consumption, 0);
  return { top3, avg, fee, total };
}

function displayAllSummaries(adjustedOriginal, original, adjustedTargeted, targeted, adjustedFlattened, flattened) {
  const format = (value) => value.toFixed(2).replace('.', ',');

  const origStats = top3Info(adjustedOriginal, original);
  const targStats = top3Info(adjustedTargeted, targeted);
  const flatStats = top3Info(adjustedFlattened, flattened);

  const lines = [
    "FÖRE OPTIMERING",
    `Total förbrukning: ${format(origStats.total)} kWh`,
    `Topp 3 justerade: ${origStats.top3.map(e => format(e.adjusted)).join(', ')}`,
    `Medeltopp: ${format(origStats.avg)} kW`,
    `Effektavgift: ${format(origStats.fee)} kr`,
    "",
    "EFTER OPTIMERING (TOPP 3 REDUKTION)",
    `Total förbrukning: ${format(targStats.total)} kWh`,
    `Topp 3 justerade: ${targStats.top3.map(e => format(e.adjusted)).join(', ')}`,
    `Medeltopp: ${format(targStats.avg)} kW`,
    `Effektavgift: ${format(targStats.fee)} kr`,
    "",
    "EFTER OPTIMERING (LINJÄR FÖRDELNING)",
    `Total förbrukning: ${format(flatStats.total)} kWh`,
    `Topp 3 justerade: ${flatStats.top3.map(e => format(e.adjusted)).join(', ')}`,
    `Medeltopp: ${format(flatStats.avg)} kW`,
    `Effektavgift: ${format(flatStats.fee)} kr`,
  ];

  document.getElementById("output").textContent = lines.join("\n");
}
