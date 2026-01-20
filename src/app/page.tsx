"use client";
import React, { useState, useEffect } from 'react';
import { Package, Truck, Warehouse, Play, RefreshCcw } from 'lucide-react';

export default function LogiSim() {
  const [grid, setGrid] = useState(Array(25).fill(null));
  const [money, setMoney] = useState(100);
  const [score, setScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);

  // Voeg een pakketje toe aan een willekeurige lege plek
  const addPackage = () => {
    const emptySlots = grid.map((v, i) => v === null ? i : null).filter(v => v !== null);
    
    if (emptySlots.length === 0) {
      alert("Magazijn vol! Game Over.");
      resetGame();
      return;
    }

    const randomSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    const newGrid = [...grid];
    newGrid[randomSlot] = { id: Date.now(), type: 'standard' };
    setGrid(newGrid);
  };

  // Verwerk (verwijder) een pakketje
  const processPackage = (index: number) => {
    if (!gameActive || grid[index] === null) return;
    
    const newGrid = [...grid];
    newGrid[index] = null;
    setGrid(newGrid);
    setMoney(m => m + 15);
    setScore(s => s + 1);
  };

  const resetGame = () => {
    setGrid(Array(25).fill(null));
    setMoney(100);
    setScore(0);
    setGameActive(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center font-sans">
      <h1 className="text-4xl font-bold mb-4 flex items-center gap-2">
        <Warehouse className="text-blue-400" /> LogiSim 2D
      </h1>

      <div className="flex gap-8 mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Budget</p>
          <p className="text-2xl font-mono text-green-400">€{money}</p>
        </div>
        <div className="text-center">
          <p className="text-slate-400 text-sm">Verwerkt</p>
          <p className="text-2xl font-mono text-blue-400">{score}</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 bg-slate-700 p-3 rounded-lg shadow-2xl">
        {grid.map((cell, i) => (
          <div
            key={i}
            onClick={() => processPackage(i)}
            className={`w-16 h-16 sm:w-24 sm:h-24 border-2 rounded-md flex items-center justify-center transition-all cursor-pointer
              ${cell ? 'bg-orange-500 border-orange-300 hover:scale-95' : 'bg-slate-800 border-slate-600 hover:bg-slate-750'}`}
          >
            {cell && <Package size={40} className="text-white animate-bounce" />}
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-4">
        {!gameActive ? (
          <button 
            onClick={() => setGameActive(true)}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition"
          >
            <Play size={20} /> Start Operatie
          </button>
        ) : (
          <button 
            onClick={addPackage}
            className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition"
          >
            <Truck size={20} /> Inkomende Zending (€10 kosten)
          </button>
        )}
        
        <button 
          onClick={resetGame}
          className="bg-slate-700 hover:bg-slate-600 p-3 rounded-full transition"
        >
          <RefreshCcw size={20} />
        </button>
      </div>

      <p className="mt-6 text-slate-400 text-sm">
        Klik op een pakketje om het te verzenden en geld te verdienen!
      </p>
    </div>
  );
}