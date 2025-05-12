import { GoteborgStrategy } from "./ge";
import { EllevioStrategy } from "./ellevio";
export { GoteborgStrategy, EllevioStrategy }

export interface EnergyData {
	timestamp: Date;
	usage: number;
}

export interface TransferLog {
	from: Date;
	to: Date;
	amount: number;
}

export enum StrategyTypes {
	Top3Peak = "Top-N-optimering: Minska toppar genom att fördela energi från de högsta N posterna."
}

const providerStrategies: { [key: string]: ProviderStrategy } = {
	Ellevio: new EllevioStrategy(),
	GE: new GoteborgStrategy(),
};

export function getProviderStrategy(provider: string): ProviderStrategy {
	const strategy = providerStrategies[provider];
	if (!strategy) {
		throw new Error(`No strategy found for provider: ${provider}`);
	}
	return strategy;
}

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

export interface EnergyMetrics {
	totalUsage: number;
	top3Peaks: number[];
	averageTop3: number;
	powerFee: number;
	originalTop3Peaks?: number[];
	originalAverageTop3?: number;
	originalPowerFee?: number;
	transfers: TransferLog[];
	data: EnergyData[];
	// Endast för Ellevio
	adjustedData?: EnergyData[];
	rate: number;
}

export interface ProviderStrategy {
	strategyType: StrategyTypes
	calculateMetrics(oldData: EnergyData[]): EnergyMetrics;
	applyRule(data: EnergyData[]): { timestamp: Date; usage: number }[];
	getTips(): string[];
	// returns the hours [0–23] that count as “night” for shading 
  	getNightHours?(): number[];
}
