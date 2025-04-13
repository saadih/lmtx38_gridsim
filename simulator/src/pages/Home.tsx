import React, { useState } from "react";
import * as Papa from "papaparse";
import Result from "./Result";

const Home: React.FC = () => {
  const [formData, setFormData] = useState<{
    konsumtion: string;
    kostnad: string;
    snittpris: string;
    sparat: string;
  }>({
    konsumtion: "",
    kostnad: "",
    snittpris: "",
    sparat: "",
  });

  const [showResult, setShowResult] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        complete: (result) => {
          const data = result.data as { Konsumtion: string; Kostnad: string; Snittpris: string; Sparat: string }[];

          if (data.length > 0) {
            const firstRow = data[0];
            setFormData({
              konsumtion: firstRow.Konsumtion || "",
              kostnad: firstRow.Kostnad || "",
              snittpris: firstRow.Snittpris || "",
              sparat: firstRow.Sparat || "",
            });
            setShowResult(true); 
          }
        },
        header: true, 
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl text-center font-bold">Energi Kalkylator</h1>
      <div className="mt-8 text-center">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="mb-4 px-4 py-2 border border-gray-300 rounded-md"
        />
      </div>

      {showResult && (
        <Result
          konsumtion={formData.konsumtion}
          kostnad={formData.kostnad}
          snittpris={formData.snittpris}
          sparat={formData.sparat}
        />
      )}
    </div>
  );
};

export default Home;
