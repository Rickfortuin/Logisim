"use client";
import React, { useState, useEffect } from 'react';

// Kleuren configuratie
const COLORS = ['red', 'blue', 'green'];
const MAX_PALLET_CAPACITY = 70; // Zoals gevraagd
const ROLLTAINER_CAPACITY = 28; // 2x2x7

export default function HorecaLogistiek() {
  // State voor de rolltainer (de kratten)
  const [rolltainer, setRolltainer] = useState<{id: number, color: string}[]>([]);
  
  // State voor de pallets (opslag)
  const [pallets, setPallets] = useState([
    { color: 'red', count: 0 },
    { color: 'blue', count: 0 },
    { color: 'green', count: 0 },
  ]);

  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Sleep kratten naar de juiste pallet!");

  // Initialiseer de eerste rolltainer bij start
  useEffect(() => {
    getNewRolltainer();
  }, []);

  // Functie om een nieuwe rolltainer te genereren (28 kratten)
  const getNewRolltainer = () => {
    const newCrates = Array.from({ length: ROLLTAINER_CAPACITY }).map((_, i) => ({
      id: Date.now() + i,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
    setRolltainer(newCrates);
    setMessage("Nieuwe rolltainer binnengekomen!");
  };

  // --- DRAG & DROP HANDLERS ---

  // Start slepen (kan een krat zijn OF een volle pallet)
  const handleDragStart = (e: React.DragEvent, type: 'crate' | 'pallet', data: any) => {
    e.dataTransfer.setData("type", type);
    e.dataTransfer.setData("data", JSON.stringify(data));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Nodig om drop toe te staan
  };

  // Drop logica
  const handleDrop = (e: React.DragEvent, targetType: 'pallet' | 'truck', targetIndex?: number) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    const data = JSON.parse(e.dataTransfer.getData("data"));

    // SCENARIO 1: Krat op Pallet droppen
    if (type === 'crate' && targetType === 'pallet') {
      const targetPallet = pallets[targetIndex!];
      
      // Validatie
      if (targetPallet.color !== data.color) {
        setMessage("❌ Verkeerde kleur! Kijk goed.");
        return;
      }
      if (targetPallet.count >= MAX_PALLET_CAPACITY) {
        setMessage("⚠️ Deze pallet is vol (70)! Sleep hem naar de vrachtwagen.");
        return;
      }

      // Update state: Verwijder uit rolltainer, voeg toe aan pallet
      const newRolltainer = rolltainer.filter(c => c.id !== data.id);
      setRolltainer(newRolltainer);

      const newPallets = [...pallets];
      newPallets[targetIndex!].count += 1;
      setPallets(newPallets);
      
      // Feedback
      if (newPallets[targetIndex!].count === MAX_PALLET_CAPACITY) {
        setMessage(`🎉 ${data.color.toUpperCase()} pallet is VOL! Sleep naar de truck.`);
      }
    }

    // SCENARIO 2: Volle Pallet op Truck droppen
    if (type === 'pallet' && targetType === 'truck') {
      const palletIndex = data.index;
      const pallet = pallets[palletIndex];

      if (pallet.count < MAX_PALLET_CAPACITY) {
        setMessage(`❌ Deze pallet is nog niet vol (pas ${pallet.count}/${MAX_PALLET_CAPACITY}).`);
        return;
      }

      // Pallet is vol en wordt op truck geladen
      const newPallets = [...pallets];
      newPallets[palletIndex].count = 0; // Reset pallet
      setPallets(newPallets);
      setScore(s => s + 500); // Grote bonus
      setMessage("🚛 Pallet geladen! Goed werk.");
    }
  };

  // Helper voor kleuren
  const getColorClass = (color: string) => {
    switch(color) {
      case 'red': return 'bg-red-500 border-red-700';
      case 'blue': return 'bg-blue-500 border-blue-700';
      case 'green': return 'bg-green-500 border-green-700';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">Horeca Distributie</h1>
            <p className="text-slate-400 text-sm">Vul pallets tot 70 stuks → Sleep naar truck</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">SCORE</p>
            <p className="text-3xl font-mono text-green-400">€ {score}</p>
          </div>
        </div>

        {/* Message Bar */}
        <div className="text-center mb-6 h-8 font-semibold text-orange-300">
          {message}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* ZONE 1: ROLLTAINER (BRON) */}
          <div className="flex flex-col items-center bg-slate-800 p-4 rounded-xl min-h-[500px] border-2 border-slate-600">
            <h2 className="font-bold mb-4 flex items-center gap-2">🛒 Horeca Rolltainer <span className="text-xs font-normal text-slate-400">({rolltainer.length} stuks)</span></h2>
            
            {/* De Rolltainer Container */}
            <div className="border-4 border-zinc-400 rounded-lg p-2 bg-zinc-800 w-48 min-h-[400px] relative">
              {/* Raster voor 2 breed */}
              <div className="grid grid-cols-2 gap-1 content-end h-full">
                {rolltainer.map((crate) => (
                  <div
                    key={crate.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'crate', crate)}
                    className={`${getColorClass(crate.color)} h-10 rounded shadow-md border-b-4 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform flex items-center justify-center`}
                  >
                    <span className="text-[10px] opacity-50">|||</span>
                  </div>
                ))}
              </div>
              
              {/* Leegmelding */}
              {rolltainer.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <p className="text-slate-500 mb-4">Rolltainer leeg</p>
                  <button 
                    onClick={getNewRolltainer}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded font-bold animate-pulse"
                  >
                    Nieuwe Halen
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 w-48 h-4 bg-zinc-600 rounded-full mx-auto"></div> {/* Wielen suggestie */}
          </div>

          {/* ZONE 2: PALLETS (SORTEREN) */}
          <div className="flex flex-col gap-4">
            {pallets.map((pallet, index) => {
              const isFull = pallet.count >= MAX_PALLET_CAPACITY;
              const fillPercentage = (pallet.count / MAX_PALLET_CAPACITY) * 100;

              return (
                <div 
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'pallet', index)}
                  draggable={isFull} // Alleen sleepbaar als hij vol is
                  onDragStart={(e) => isFull && handleDragStart(e, 'pallet', { index, color: pallet.color })}
                  className={`relative p-4 rounded-xl border-2 transition-all h-40 flex flex-col justify-between
                    ${isFull 
                      ? 'bg-yellow-900/50 border-yellow-400 cursor-grab hover:scale-105 shadow-yellow-500/20 shadow-lg' 
                      : 'bg-slate-800 border-slate-700'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`font-bold px-2 py-1 rounded text-xs uppercase ${getColorClass(pallet.color)} text-white`}>
                      {pallet.color} Pallet
                    </span>
                    <span className="font-mono text-2xl font-bold">{pallet.count} / {MAX_PALLET_CAPACITY}</span>
                  </div>

                  {/* Visuele representatie van stapel */}
                  <div className="flex-1 flex items-end justify-center py-2 gap-1 overflow-hidden">
                    {/* We tonen een paar 'blokjes' om vulling aan te geven */}
                    {Array.from({ length: Math.min(10, Math.ceil(pallet.count / 7)) }).map((_, i) => (
                       <div key={i} className={`w-8 h-8 rounded ${getColorClass(pallet.color)} opacity-80 border border-black/20`}></div>
                    ))}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${isFull ? 'bg-yellow-400' : 'bg-blue-400'}`} 
                      style={{ width: `${fillPercentage}%` }}
                    ></div>
                  </div>

                  {isFull && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl backdrop-blur-sm">
                      <p className="font-bold text-yellow-400 text-lg animate-bounce">SLEEP NAAR TRUCK ➔</p>
                    </div>
                  )}
                  
                  {/* Houten pallet bodem */}
                  <div className="h-3 w-full bg-[#8B4513] rounded mt-1 opacity-80"></div>
                </div>
              );
            })}
          </div>

          {/* ZONE 3: UITGAANDE VRACHTWAGEN (EXPEDITIE) */}
          <div 
             onDragOver={handleDragOver}
             onDrop={(e) => handleDrop(e, 'truck')}
             className="bg-slate-800 border-l-4 border-dashed border-slate-600 p-4 h-full rounded-xl flex flex-col items-center justify-center relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            
            <h2 className="text-xl font-bold mb-8 z-10">🚛 Expeditie Truck</h2>
            
            <div className="w-48 h-64 border-4 border-slate-500 border-t-0 bg-slate-900/50 rounded-b-lg flex items-end justify-center pb-4 relative transition-colors group-hover:bg-slate-700/50">
                <span className="text-6xl opacity-20">🚚</span>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center w-full px-2">
                  <p className="text-slate-400 text-sm">Sleep VOLLE pallets (70 stuks) hierheen</p>
                </div>
            </div>
            
            <div className="mt-4 bg-zinc-800 w-full p-2 text-center rounded border border-zinc-700">
               <p className="text-xs text-zinc-400">VOLGENDE VERTREK</p>
               <p className="text-green-400 font-mono">14:00</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}