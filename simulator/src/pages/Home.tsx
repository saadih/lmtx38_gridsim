import React, { useState } from "react";
import * as Papa from "papaparse";
import Result from "./Result";
import { parseEnergyData, EnergyData } from "../utils/energyCalculations";

import { Dropdown } from "../components/Dropdown";

const Home: React.FC = () => {

  // Dropdown for selecting energy provider
  type Provider = "Ellevio" | "GE" ;
  const [provider, setProvider] = useState<Provider>("Ellevio");

  // Other states
  const [dataRows, setDataRows] = useState<EnergyData[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setShowResult(false);

    Papa.parse(file, {
      complete: (result) => {
        try {
          const parsed = result.data as string[][];

          if (parsed.length === 0) {
            throw new Error("CSV-filen är tom");
          }

          const cleaned = parsed
            .filter(
              (row) =>
                row.length >= 2 &&
                !row[0].startsWith("#") &&
                row[0].toLowerCase() !== "date"
            )
            .map(([timestamp, rawUsage]) => {
              const usage = parseFloat(rawUsage.replace(",", "."));
              if (isNaN(usage)) {
                throw new Error(`Ogiltigt värde för förbrukning: ${rawUsage}`);
              }
              return { timestamp, usage };
            });

          if (cleaned.length === 0) {
            throw new Error("Ingen giltig data hittades i filen");
          }

          setDataRows(parseEnergyData(cleaned));
          setShowResult(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ett oväntat fel inträffade");
        } finally {
          setIsLoading(false);
        }
      },
      error: (error) => {
        setError(`Fel vid läsning av CSV: ${error.message}`);
        setIsLoading(false);
      },
      delimiter: ";",
      skipEmptyLines: true,
      header: false,
    });
  };

  const handleReset = () => {
    setDataRows([]);
    setShowResult(false);
    setError(null);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Energibesparnings Kalkylator</h1>
        <p className="text-gray-600">Ladda upp din energidata i CSV-format</p>
      </header>

      <div className="bg-white rounded-lg shadow-md p-6">
      {/* Dropdown for selecting provider */}
      <div className="mb-6 flex justify-center">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Välj leverantör
        </label>
        <Dropdown
          options={["Ellevio", "GE"]}
          value={provider}
          onChange={(v) => setProvider(v as Provider)}
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col items-center">
          <label className="w-full max-w-md mb-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
              <div className="flex flex-col items-center">
                <svg
                  className="w-12 h-12 text-gray-400 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-gray-700">
                  {isLoading ? "Bearbetar fil..." : "Välj en CSV-fil"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Filen ska innehålla tidstämpel och förbrukning separerade med semikolon
                </p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
            </div>
          </label>

          {error && (
            <div className="w-full max-w-md bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {showResult && (
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Ladda upp ny fil
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
        {/* Result table */}
        {showResult && !isLoading && (
          
        <Result data={dataRows} provider={provider} />
      )}
      </div>
    </div>
    </div>
  );
};

export default Home;