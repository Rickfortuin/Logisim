"use client";
import React, { useState } from 'react';

// Types voor de pakketjes
const SIZES = {
  S: { label: 'Small', class: 'w-8 h-8', score: 10 },
  M: { label: 'Medium', class: 'w-12 h-12', score: 20 },
  L: { label: 'Large', class: 'w-16 h-16', score: 30 }
};

export default function WarenhuisGame() {
  const [truckPackage, setTruckPackage] = useState(generateRandomPackage());
  const [warehouse, setWarehouse] = useState(Array(12).fill(null));
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Sleep het pakket naar een leeg vak!");

  function generateRandomPackage() {
    const keys = Object.keys(SIZES) as (keyof typeof SIZES)[];
    const sizeKey = keys[Math.floor(Math.random() * keys.length)];
    return {
      id: Math.random(),
      size: sizeKey,
      ...SIZES[sizeKey]
    };
  }

  // Drag handlers
  const onDragStart = (e: React.DragEvent<HTMLDivElement>, pkg: typeof truckPackage) => {
    e.dataTransfer.setData("pkg", JSON.stringify(pkg));
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Nodig om drop toe te staan
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const pkg = JSON.parse(e.dataTransfer.getData("pkg"));

    if (warehouse[index] !== null) {
      setMessage("❌ Dit vak is al bezet!");
      return;
    }

    // Succesvolle plaatsing
    const newWarehouse = [...warehouse];
    newWarehouse[index] = pkg;
    setWarehouse(newWarehouse);
    setScore(s => s + pkg.score);
    setMessage(`✅ Goed gedaan! +€${pkg.score}`);
    
    // Nieuw pakketje in de vrachtwagen
    setTruckPackage(generateRandomPackage());
  };

  const resetGame = () => {
    setWarehouse(Array(12).fill(null));
    setScore(0);
    setTruckPackage(generateRandomPackage());
    setMessage("Spel gereset.");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 flex flex-col items-center">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-blue-400 mb-2">📦 LogiDrag 2D</h1>
        <p className="text-gray-400">Sleep pakketten van de truck naar het magazijn</p>
      </header>

      <div className="flex flex-col md:flex-row gap-12 items-start justify-center w-full max-w-5xl">
        
        {/* LINKER KANT: De Vrachtwagen */}
        <div className="flex flex-col items-center bg-gray-800 p-6 rounded-2xl border-4 border-dashed border-gray-700 w-64">
          <h2 className="text-xl font-bold mb-4">🚛 Vrachtwagen</h2>
          <div className="h-32 flex items-center justify-center bg-gray-700 w-full rounded-lg relative">
            {truckPackage && (
              <div
                draggable
                onDragStart={(e) => onDragStart(e, truckPackage)}
                className={`${truckPackage.class} bg-orange-500 rounded-md cursor-grab active:cursor-grabbing flex items-center justify-center shadow-lg border-2 border-orange-300 transition-transform hover:scale-110`}
              >
                <span className="text-[10px] font-bold">{truckPackage.size}</span>
              </div>
            )}
          </div>
          <p className="mt-4 text-sm text-gray-400 italic">Sleep mij!</p>
        </div>

        {/* RECHTER KANT: Het Magazijn */}
        <div className="flex flex-col items-center">
          <div className="flex justify-between w-full mb-4 px-2">
            <span className="text-xl font-mono text-green-400">Winst: €{score}</span>
            <button onClick={resetGame} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Reset</button>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-4 gap-4 bg-gray-800 p-6 rounded-3xl shadow-2xl border-b-8 border-gray-950">
            {warehouse.map((slot, i) => (
              <div
                key={i}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, i)}
                className="w-20 h-20 md:w-24 md:h-24 bg-gray-900 border-2 border-gray-700 rounded-xl flex items-center justify-center transition-colors hover:border-blue-500"
              >
                {slot ? (
                  <div className={`${slot.class} bg-blue-600 rounded flex items-center justify-center border border-blue-300 animate-in zoom-in duration-300`}>
                     <span className="text-[10px]">{slot.size}</span>
                  </div>
                ) : (
                  <span className="text-gray-700 text-xs">VAK {i + 1}</span>
                )}
              </div>
            ))}
          </div>
          
          <div className={`mt-6 p-3 rounded-lg text-center font-bold ${message.includes('✅') ? 'text-green-400' : 'text-orange-400'}`}>
            {message}
          </div>
        </div>

      </div>

      <footer className="mt-auto pt-10 text-gray-500 text-xs">
        Gebruik een muis om te slepen • Ontwikkeld voor Vercel
      </footer>
    </div>
  );
}