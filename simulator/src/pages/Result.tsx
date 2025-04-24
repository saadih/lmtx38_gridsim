import React from "react";
import {
  calculateEnergyMetrics,
  calculateGeMetrics,
  EnergyData,
  optimizeTopNPeaks,
  optimizeTopNPeaksGE,
  applyEllevioRule,
} from "../utils/energyCalculations";

interface EnergyMetrics {
  totalUsage: number;
  top3Peaks: number[];
  averageTop3: number;
  powerFee: number;
  originalTop3Peaks?: number[];
  originalAverageTop3?: number;
  originalPowerFee?: number;
}

interface ResultProps {
  data: EnergyData[];
  provider: "Ellevio" | "GE";
}

const Result: React.FC<ResultProps> = ({ data, provider }) => {
  // Generera optimerad data en gång
  const optimizedData =
    provider === "GE"
      ? optimizeTopNPeaksGE(data)
      : optimizeTopNPeaks(data);
	  
   const adjustedData = applyEllevioRule(optimizedData).map(({ timestamp, adjusted }) => ({
		timestamp,
		usage: adjusted,
	}));
	

  // Beräkna nyckeltal mot optimerad data
  const metrics: EnergyMetrics =
    provider === "GE"
      ? calculateGeMetrics(optimizedData)
      : {
          ...calculateEnergyMetrics(adjustedData),
          originalTop3Peaks: [...data]
            .sort((a, b) => b.usage - a.usage)
            .slice(0, 3)
            .map((e) => e.usage),
          originalAverageTop3: calculateOriginalAverageTop3(data),
          originalPowerFee: calculateOriginalPowerFee(data),
        };




  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Optimering Resultat</h2>
        <p className="text-gray-600">
          Effektiviserad energiförbrukning med topplastoptimering
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Totalförbrukning */}
        <MetricCard
          title="Total Förbrukning"
          value={`${metrics.totalUsage.toFixed(2)} kWh`}
          description="Totalförbrukning förändras inte vid optimering"
        />

        {/* Medeltopp efter optimering */}
        <MetricCard
          title="Medeltopp (Efter optimering)"
          value={
            <>
              <span>{metrics.averageTop3.toFixed(2)} kWh</span>
              <span className="block text-sm text-gray-500">
                (Före: {metrics.originalAverageTop3?.toFixed(2)} kWh)
              </span>
            </>
          }
          changePercentage={calculateChangePercentage(
            metrics.originalAverageTop3 || 0,
            metrics.averageTop3
          )}
        />

        {/* Topp 3 Förbrukningstoppar */}
        <div className="md:col-span-2">
          <MetricCard
            title="Topp 3 Förbrukningstoppar"
            value={
              <ul className="space-y-2 mb-2">
                {metrics.top3Peaks.map((peak, i) => (
                  <li key={i} className="flex justify-between">
                    <span>Topp {i + 1}:</span>
                    <div className="flex items-center">
                      <span className="text-gray-500 text-sm line-through mr-2">
                        {metrics.originalTop3Peaks?.[i].toFixed(2)} kWh
                      </span>
                      <span className="font-medium">
                        {peak.toFixed(2)} kWh
                      </span>
                      <span className="ml-2 text-sm text-green-600">
                        ↓{calculateChangePercentage(
                          metrics.originalTop3Peaks?.[i] || 0,
                          peak
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            }
            description="* 50% av topparna har flyttats till natttimmar"
          />
        </div>

        {/* Effektavgift */}
        <MetricCard
          title="Effektavgift (Efter optimering)"
          value={
            <>
              <span>{metrics.powerFee.toFixed(2)} SEK</span>
              <span className="block text-sm text-gray-500">
                (Före: {metrics.originalPowerFee?.toFixed(2)} SEK)
              </span>
            </>
          }
          highlight
          changePercentage={calculateChangePercentage(
            metrics.originalPowerFee || 0,
            metrics.powerFee
          )}
        />
      </section>

      {/* Tabell med optimerad data */}
      <section className="overflow-x-auto">
        <h3 className="text-lg font-semibold mb-2">Optimerad Förbrukning</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tidpunkt
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Förbrukning (kWh)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {optimizedData.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 text-sm text-gray-900">
                  {row.timestamp.toLocaleString('sv-SE')}
                </td>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {row.usage.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

// Hjälpkomponenter
const MetricCard: React.FC<{
  title: string;
  value: React.ReactNode;
  description?: string;
  highlight?: boolean;
  changePercentage?: string;
}> = ({ title, value, description, highlight = false, changePercentage }) => (
  <div className={`p-4 rounded-lg border ${highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
    <h3 className="text-sm font-medium text-gray-600">{title}</h3>
    <div className={`mt-1 text-2xl ${highlight ? 'font-bold text-blue-600' : 'font-semibold text-gray-800'}`}>{value}</div>
    {changePercentage && <div className={`mt-1 text-sm ${changePercentage.startsWith('-') ? 'text-green-600' : 'text-red-600'}`}>{changePercentage.startsWith('-') ? 'Besparing ' : 'Ökning '}{changePercentage}</div>}
    {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
  </div>
);

function calculateChangePercentage(original: number, optimized: number): string {
  const change = ((optimized - original) / original) * 100;
  return `${Math.abs(change).toFixed(1)}%`;
}

function calculateOriginalAverageTop3(data: EnergyData[]): number {
  const top3 = [...data].sort((a, b) => b.usage - a.usage).slice(0, 3).map(e => e.usage);
  return top3.reduce((sum, v) => sum + v, 0) / 3;
}

function calculateOriginalPowerFee(data: EnergyData[]): number {
  const adjusted = data.map(({ timestamp, usage }) => ({
    adjustedUsage: isNightTime(timestamp) ? usage / 2 : usage
  }));
  const totalAdj = adjusted.reduce((sum, e) => sum + e.adjustedUsage, 0);
  return totalAdj * 0.6;
}

function isNightTime(timestamp: Date): boolean {
  const hour = timestamp.getHours();
  return [22,23,0,1,2,3,4,5].includes(hour);
}

export default Result;