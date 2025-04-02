import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function SimulatorHome() {
  const [data, setData] = useState([
    { name: "Point 1", value: 10 },
    { name: "Point 2", value: 20 },
    { name: "Point 3", value: 15 },
    { name: "Point 4", value: 30 },
  ]);

  const handleUserInput = () => {
    const newData = data.map(point => ({
      ...point,
      value: point.value + Math.floor(Math.random() * 10 - 5),
    }));
    setData(newData);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6 p-6">
      <h1 className="text-2xl font-bold">Simulator</h1>
      <Button onClick={handleUserInput}>Update Data</Button>
      <div className="w-full max-w-4xl h-96 bg-white shadow-lg rounded-lg p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
