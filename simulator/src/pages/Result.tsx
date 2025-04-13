import React from "react";

interface ResultProps {
  konsumtion: string;
  kostnad: string;
  snittpris: string;
  sparat: string;
}

const Result: React.FC<ResultProps> = ({ konsumtion, kostnad, snittpris, sparat }) => {
  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold">Resultat</h2>
      <div className="space-y-4 mt-4">
        <div>
          <strong>Konsumtion:</strong> {konsumtion} kWh
        </div>
        <div>
          <strong>Kostnad med timavräkning:</strong> {kostnad} SEK
        </div>
        <div>
          <strong>Snittpris med kWh:</strong> {snittpris} SEK
        </div>
        <div>
          <strong>Sparat:</strong> {sparat} SEK
        </div>
      </div>
    </div>
  );
};

export default Result;
