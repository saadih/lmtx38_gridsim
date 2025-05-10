import { EnergyData, EnergyMetrics, TransferLog, ProviderStrategy, StrategyTypes } from "./core";

const HIGH_RATE = 132; // SEK/kW for high-price periods
const LOW_RATE = 0;    // SEK/kW for low-price periods

// Check if a date is within the high-rate period (1 Nov - 31 Mar)
function isHighRatePeriod(date: Date): boolean {
    const month = date.getMonth() + 1;
    return month >= 11 || month <= 3;
}

// Check if a date is a weekend or a holiday
function isHolidayOrWeekend(date: Date): boolean {
    const day = date.getDay();
    const holidays = [
        "01-01", // New Year's Day
        "01-06", // Epiphany
        "04-18", // Good Friday
        "04-21", // Easter Monday
        "12-25", // Christmas Day
        "12-26"  // Boxing Day
    ];

    const dateStr = date.toISOString().slice(5, 10);
    return day === 0 || day === 6 || holidays.includes(dateStr);
}

// Check if the date falls within high-price hours (07:00-20:00 on weekdays)
function isHighRateHour(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 7 && hour < 20;
}

function calculatePowerFee(date: Date, averageTop3: number): number {
    if (!isHighRatePeriod(date) || isHolidayOrWeekend(date) || !isHighRateHour(date)) {
        return averageTop3 * LOW_RATE;
    }
    return averageTop3 * HIGH_RATE;
}

function optimizeTopNPeaksGE(data: EnergyData[], topN: number = 3): { optimized: EnergyData[]; transfers: TransferLog[] } {
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

    return { optimized, transfers };
}

export class NewGoteborgStrategy implements ProviderStrategy {
    strategyType = StrategyTypes.Top3Peak;
	additionalInformation: string = "Detta gäller för den nya GE elprismodellen. läs mer här: https://www.goteborgenergi.se/privat/elnat/nya-elnatsavgiftsmodellen";
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

        // Calculate the power fee based on the first peak's timestamp
        const powerFee = calculatePowerFee(new Date(optimized[0].timestamp), averageTop3);
        const originalPowerFee = calculatePowerFee(new Date(data[0].timestamp), originalAverageTop3);

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
            rate: HIGH_RATE
        };
    }

    applyRule(data: EnergyData[]): { timestamp: Date; usage: number }[] {
        // No special rules beyond fee calculation
        return data.map(({ timestamp, usage }) => ({ timestamp, usage }));
    }

   getTips(): string[] {
    return [
        "Minska energianvändningen under högprisperioder (vardagar 07:00–20:00, november–mars) för att spara kostnader.",
        "Flytta energikrävande aktiviteter till lågbelastningstimmar, helger eller röda dagar då effektavgiften är 0 kr.",
        "Överväg att välja en tidsindelad elnätsavgift om du kan planera din energianvändning till lågpristimmar.",
        "Välj en effektgräns som passar din förbrukning (6 kW, 14 kW eller 43 kW) för att optimera dina kostnader.",
        "Tänk på att om du överstiger din valda effektgräns mer än tre gånger, kommer du att flyttas tillbaka till den ordinarie prismodellen.",
        "Övervaka dina energiförbrukningsmönster regelbundet för att identifiera toppar och optimera användningen.",
        "Överväg att använda energieffektiva apparater för att minska din energiförbrukning under högprisperioder.",
        "Läs mer om den tidsindelade elnätsavgiften här: https://www.goteborgenergi.se/privat/elnat/nya-elnatsavgiftsmodellen"
    ];
}
}
