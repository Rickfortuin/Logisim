"use client";
import React, { useState, useEffect } from 'react';

// --- CONFIGURATIE & TYPES ---

const COLORS = ['red', 'blue', 'green', 'purple'];
const MAX_PALLET = 70;
const GRID_SIZE = 8; // Groter grid voor meer speelruimte
const TICK_SPEED = 800; 

type StructureType = 'pallet' | 'conveyor' | 'sorter' | 'rolltainer' | 'cobot';

interface GridCell {
  id: string;
  type: StructureType;
  color?: string;       // Filterkleur (sorter/pallet) of Kratkleur (rolltainer)
  count?: number;       // Aantal op pallet
  rotation?: number;    // 0=Boven, 1=Rechts, 2=Onder, 3=Links (of 0=Verticaal, 1=Horizontaal voor Cobot)
  crate?: string | null; // Het kratje dat momenteel getransporteerd wordt
}

interface ShopItem {
  type: StructureType;
  price: number;
  label: string;
  icon: string;
  desc: string;
}

const SHOP_ITEMS: ShopItem[] = [
  { type: 'rolltainer', price: 200, label: 'Rolltainer', icon: '🛒', desc: 'Bron van pakketten' },
  { type: 'cobot', price: 300, label: 'Cobot', icon: '🦾', desc: 'Pakt uit rolltainer -> naar band' },
  { type: 'conveyor', price: 50, label: 'Band', icon: '⬆️', desc: 'Transport' },
  { type: 'sorter', price: 150, label: 'Sorter', icon: '🔀', desc: 'Sorteert op kleur' },
  { type: 'pallet', price: 100, label: 'Pallet', icon: '📦', desc: 'Opslag' },
];

export default function WarenhuisSim() {
  // --- STATE ---
  const [grid, setGrid] = useState<(GridCell | null)[]>(Array(GRID_SIZE * GRID_SIZE).fill(null));
  const [money, setMoney] = useState(1000); // Iets meer startgeld voor de dure machines
  const [score, setScore] = useState(0);
  
  // Interactie
  const [selectedShopItem, setSelectedShopItem] = useState<StructureType | null>(null);
  const [moveSourceIndex, setMoveSourceIndex] = useState<number | null>(null);
  const [isMoveMode, setIsMoveMode] = useState(false);

  // --- HULPFUNCTIES ---

  const uid = () => Math.random().toString(36).substr(2, 9);

  // Helper om buur-index te vinden. 
  // Voor Cobot (asgewijs) en Banden (richting)
  const getNeighborIndex = (index: number, direction: number) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    let nextRow = row;
    let nextCol = col;

    if (direction === 0) nextRow--; // Boven
    if (direction === 1) nextCol++; // Rechts
    if (direction === 2) nextRow++; // Onder
    if (direction === 3) nextCol--; // Links

    if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) return null;
    return nextRow * GRID_SIZE + nextCol;
  };

  // --- GAME LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
      setGrid((currentGrid) => {
        const nextGrid = JSON.parse(JSON.stringify(currentGrid));
        let changed = false;

        // STAP 1: ROLLTAINERS GENEREREN KRATJES
        // Als een rolltainer geen kratje "klaar" heeft staan, maakt hij er een.
        for (let i = 0; i < currentGrid.length; i++) {
          const cell = nextGrid[i]; // Gebruik nextGrid om direct te updaten
          if (cell && cell.type === 'rolltainer' && !cell.crate) {
             // 20% kans per tick dat er een nieuwe verschijnt (simuleer aanvoer)
             if (Math.random() > 0.5) {
                 cell.crate = COLORS[Math.floor(Math.random() * COLORS.length)];
                 changed = true;
             }
          }
        }

        // STAP 2: COBOTS (VERPLAATSEN VAN ROLLTAINER NAAR BAND)
        for (let i = 0; i < currentGrid.length; i++) {
          const cobot = currentGrid[i];
          if (cobot && cobot.type === 'cobot') {
            // Cobot rotatie: 0 = Verticaal (Checkt Boven/Onder), 1 = Horizontaal (Checkt Links/Rechts)
            const isVertical = cobot.rotation === 0 || cobot.rotation === 2;
            
            const sideA = getNeighborIndex(i, isVertical ? 0 : 3); // Boven of Links
            const sideB = getNeighborIndex(i, isVertical ? 2 : 1); // Onder of Rechts
            
            const idxs = [sideA, sideB];
            
            // Simpele logica: Zoek in buren naar een Rolltainer MET krat en een Band ZONDER krat
            let sourceIdx = -1;
            let targetIdx = -1;

            // Zoek bron
            if (idxs[0] !== null && nextGrid[idxs[0]]?.type === 'rolltainer' && nextGrid[idxs[0]]?.crate) sourceIdx = idxs[0]!;
            else if (idxs[1] !== null && nextGrid[idxs[1]]?.type === 'rolltainer' && nextGrid[idxs[1]]?.crate) sourceIdx = idxs[1]!;

            // Zoek doel (Moet een Conveyor zijn)
            if (sourceIdx !== -1) {
               // Het doel is de 'andere' kant
               const potentialTarget = sourceIdx === idxs[0] ? idxs[1] : idxs[0];
               
               if (potentialTarget !== null) {
                 const targetCell = nextGrid[potentialTarget];
                 // Check of doel een band is en leeg is
                 if (targetCell && targetCell.type === 'conveyor' && !targetCell.crate) {
                   targetIdx = potentialTarget;
                 }
               }
            }

            // ACTIE: Verplaats
            if (sourceIdx !== -1 && targetIdx !== -1) {
               nextGrid[targetIdx].crate = nextGrid[sourceIdx].crate;
               nextGrid[sourceIdx].crate = null; // Haal uit rolltainer
               changed = true;
            }
          }
        }

        // STAP 3: TRANSPORTEURS (BANDEN & SORTERS)
        // We itereren backwards om gaten te vullen zonder 'teleportatie' over de hele band in 1 tick
        // (Simpele array movement logic)
        // Maar voor stabiliteit gebruiken we hier de "Snapshot" logica van currentGrid -> nextGrid
        
        for (let i = 0; i < currentGrid.length; i++) {
          const cell = currentGrid[i];
          
          if (cell && (cell.type === 'conveyor' || cell.type === 'sorter') && cell.crate) {
            
            let targetIndex: number | null = null;

            if (cell.type === 'conveyor') {
              targetIndex = getNeighborIndex(i, cell.rotation!);
            } else if (cell.type === 'sorter') {
              if (cell.crate === cell.color) {
                targetIndex = getNeighborIndex(i, cell.rotation!); // Rechtdoor
              } else {
                targetIndex = getNeighborIndex(i, (cell.rotation! + 1) % 4); // Rechtsaf
              }
            }

            // Probeer te verplaatsen
            if (targetIndex !== null && targetIndex >= 0) {
              const targetCell = nextGrid[targetIndex];

              // Naar Pallet
              if (targetCell && targetCell.type === 'pallet') {
                if (targetCell.color === cell.crate && targetCell.count! < MAX_PALLET) {
                  targetCell.count!++;
                  nextGrid[i].crate = null; 
                  changed = true;
                }
              }
              // Naar Band/Sorter (Alleen als doel in NEXT grid nog leeg is, of in current grid leeg was)
              else if (targetCell && (targetCell.type === 'conveyor' || targetCell.type === 'sorter')) {
                 // Cruciaal: check of doel leeg is in de 'toekomstige' staat, anders schuiven dingen over elkaar
                 if (!targetCell.crate) {
                   targetCell.crate = cell.crate;
                   nextGrid[i].crate = null;
                   changed = true;
                 }
              }
            }
          }
        }

        return changed ? nextGrid : currentGrid;
      });
    }, TICK_SPEED);

    return () => clearInterval(interval);
  }, []);

  // --- HANDLERS ---

  const handleCellClick = (index: number) => {
    const cell = grid[index];

    // 1. Verplaatsen
    if (isMoveMode) {
      if (moveSourceIndex === null) {
        if (cell) setMoveSourceIndex(index);
      } else {
        const newGrid = [...grid];
        const temp = newGrid[moveSourceIndex];
        newGrid[moveSourceIndex] = newGrid[index];
        newGrid[index] = temp;
        setGrid(newGrid);
        setMoveSourceIndex(null);
        setIsMoveMode(false);
      }
      return;
    }

    // 2. Bouwen
    if (selectedShopItem) {
      if (!cell) {
        const item = SHOP_ITEMS.find(i => i.type === selectedShopItem);
        if (item && money >= item.price) {
          const newGrid = [...grid];
          newGrid[index] = {
            id: uid(),
            type: selectedShopItem,
            rotation: (selectedShopItem === 'cobot') ? 0 : 1, // Cobot start verticaal, banden rechts
            color: (selectedShopItem === 'pallet' || selectedShopItem === 'sorter') ? 'red' : undefined,
            count: 0,
            crate: null
          };
          setGrid(newGrid);
          setMoney(m => m - item.price);
          setSelectedShopItem(null);
        }
      }
      return;
    }

    // 3. Configureren (Draaien / Kleur)
    if (cell) {
      const newGrid = [...grid];
      
      // Cobot: Toggle tussen Verticaal (0) en Horizontaal (1)
      if (cell.type === 'cobot') {
         newGrid[index] = { ...cell, rotation: cell.rotation === 0 ? 1 : 0 };
         setGrid(newGrid);
         return;
      }

      // Conveyor / Sorter: Draai 90 graden
      if (cell.type === 'conveyor' || cell.type === 'sorter') {
        newGrid[index] = { ...cell, rotation: (cell.rotation! + 1) % 4 };
        setGrid(newGrid);
      }
    }
  };

  const cycleColor = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const cell = grid[index];
    if (cell && (cell.type === 'sorter' || cell.type === 'pallet')) {
      const newGrid = [...grid];
      const currentColorIdx = COLORS.indexOf(cell.color || 'red');
      newGrid[index] = { ...cell, color: COLORS[(currentColorIdx + 1) % COLORS.length] };
      setGrid(newGrid);
    }
  };

  const handlePalletDragStart = (e: React.DragEvent, index: number) => {
      const cell = grid[index];
      if(cell && cell.type === 'pallet' && cell.count! >= MAX_PALLET) {
          e.dataTransfer.setData("type", "full_pallet");
          e.dataTransfer.setData("index", index.toString());
      }
  };

  const handleTruckDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("type");
      if(type === 'full_pallet') {
          const index = parseInt(e.dataTransfer.getData("index"));
          const newGrid = [...grid];
          newGrid[index] = null;
          setGrid(newGrid);
          setMoney(m => m + 350);
          setScore(s => s + 1);
      }
  };

  // --- VISUALS ---

  const getRotationClass = (rot: number = 0) => {
      switch(rot) {
          case 0: return 'rotate-0';
          case 1: return 'rotate-90';
          case 2: return 'rotate-180';
          case 3: return '-rotate-90';
          default: return '';
      }
  };

  const getBgColor = (c?: string) => {
      if(c === 'red') return 'bg-red-500';
      if(c === 'blue') return 'bg-blue-500';
      if(c === 'green') return 'bg-green-500';
      if(c === 'purple') return 'bg-purple-500';
      return 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans p-4 flex flex-col items-center select-none">
      
      <div className="w-full max-w-6xl flex justify-between items-center bg-neutral-800 p-4 rounded-xl border-b-4 border-neutral-700 mb-4 sticky top-0 z-20 shadow-lg">
        <div>
           <h1 className="text-xl font-black text-orange-500">WAREHOUSE SIMULATOR</h1>
           <p className="text-xs text-neutral-400">Ontwerp het ultieme proces</p>
        </div>
        <div className="flex gap-8">
            <div className="text-right">
                <span className="block text-[10px] text-neutral-400">BUDGET</span>
                <span className="text-2xl font-mono text-green-400">€{money}</span>
            </div>
             <div className="text-right">
                <span className="block text-[10px] text-neutral-400">VERKOCHT</span>
                <span className="text-2xl font-mono text-blue-400">{score}</span>
            </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start justify-center w-full max-w-7xl">
        
        {/* SHOP */}
        <div className="flex flex-col gap-2 bg-neutral-800 p-4 rounded-xl border border-neutral-700 min-w-[200px]">
          <h2 className="font-bold text-neutral-300 mb-2 border-b border-neutral-600 pb-2">MACHINES</h2>
          {SHOP_ITEMS.map((item) => (
            <button
              key={item.type}
              onClick={() => { setSelectedShopItem(item.type); setIsMoveMode(false); }}
              className={`flex flex-col p-2 rounded border transition-all text-left
                ${selectedShopItem === item.type ? 'border-orange-500 bg-neutral-700' : 'border-neutral-600 bg-neutral-800 hover:bg-neutral-700'}
                ${money < item.price ? 'opacity-40' : ''}
              `}
              disabled={money < item.price}
            >
              <div className="flex justify-between items-center w-full">
                  <span className="font-bold flex items-center gap-2">{item.icon} {item.label}</span>
                  <span className="text-green-400 font-mono text-sm">€{item.price}</span>
              </div>
              <span className="text-[10px] text-neutral-400 mt-1">{item.desc}</span>
            </button>
          ))}
          
          <div className="mt-4 pt-4 border-t border-neutral-600">
            <button
                onClick={() => { setIsMoveMode(!isMoveMode); setSelectedShopItem(null); setMoveSourceIndex(null); }}
                className={`w-full p-3 rounded font-bold text-sm transition-all
                    ${isMoveMode ? 'bg-orange-600 text-white animate-pulse' : 'bg-neutral-600 text-neutral-300'}
                `}
            >
                {isMoveMode ? 'STOP VERPLAATSEN' : '🛠️ VERPLAATSEN'}
            </button>
          </div>
        </div>

        {/* GRID (8x8) */}
        <div className="bg-neutral-800 p-4 rounded-xl shadow-2xl border-4 border-neutral-700 overflow-auto">
            <div 
                className="grid grid-cols-8 gap-1"
                style={{ width: 'fit-content' }}
            >
                {grid.map((cell, i) => (
                    <div
                        key={i}
                        onClick={() => handleCellClick(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleTruckDrop} // Alleen voor truck-drop op verkeerde plek te voorkomen
                        className={`w-14 h-14 md:w-16 md:h-16 rounded border relative flex items-center justify-center transition-all
                            ${!cell ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-600' : 'bg-neutral-700 border-neutral-600'}
                            ${isMoveMode && cell ? 'cursor-grab hover:brightness-110 border-orange-400' : ''}
                            ${selectedShopItem && !cell ? 'hover:bg-green-900/30 cursor-pointer' : ''}
                        `}
                    >
                        {cell && (
                            <div className="w-full h-full relative p-1">
                                
                                {/* ROLLTAINER */}
                                {cell.type === 'rolltainer' && (
                                   <div className="w-full h-full border-2 border-dashed border-zinc-400 rounded bg-zinc-800 flex items-center justify-center relative">
                                       <span className="absolute -top-2 -left-1 text-[8px] bg-zinc-600 px-1 rounded text-white">IN</span>
                                       {cell.crate ? (
                                           <div className={`w-8 h-8 rounded border border-white/50 shadow-lg ${getBgColor(cell.crate)} flex items-center justify-center`}>
                                               <span className="text-xs">📦</span>
                                           </div>
                                       ) : (
                                           <span className="text-xs animate-pulse">...</span>
                                       )}
                                   </div>
                                )}

                                {/* COBOT */}
                                {cell.type === 'cobot' && (
                                    <div className={`w-full h-full flex items-center justify-center transition-transform ${cell.rotation === 1 ? 'rotate-90' : ''}`}>
                                        <div className="w-2 h-full bg-slate-500 rounded-full absolute opacity-50"></div> {/* As */}
                                        <div className="w-full h-2 bg-slate-400 absolute"></div> {/* Arm */}
                                        <div className="z-10 w-8 h-8 rounded-full bg-slate-300 border-4 border-slate-500 flex items-center justify-center shadow-lg">
                                            <span className="text-sm">🦾</span>
                                        </div>
                                        {/* Pijl indicatie voor richting */}
                                        <div className="absolute top-0 text-[8px] text-slate-400">▲</div>
                                        <div className="absolute bottom-0 text-[8px] text-slate-400">▼</div>
                                    </div>
                                )}

                                {/* CONVEYOR */}
                                {cell.type === 'conveyor' && (
                                    <div className={`w-full h-full flex items-center justify-center ${getRotationClass(cell.rotation)}`}>
                                        <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20 absolute"></div>
                                        <span className="text-xl text-neutral-400 animate-pulse">⬆</span>
                                    </div>
                                )}

                                {/* SORTER */}
                                {cell.type === 'sorter' && (
                                    <div className={`w-full h-full relative border-2 border-double border-neutral-400 rounded ${getRotationClass(cell.rotation)}`}>
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px]">⬆</span>
                                        <span className="absolute top-1/2 right-0 -translate-y-1/2 text-[8px]">➡</span>
                                        <div 
                                            onClick={(e) => cycleColor(e, i)}
                                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow cursor-pointer hover:scale-110 z-10 ${getBgColor(cell.color)}`}
                                        ></div>
                                    </div>
                                )}

                                {/* PALLET */}
                                {cell.type === 'pallet' && (
                                    <div 
                                        draggable={cell.count! >= MAX_PALLET}
                                        onDragStart={(e) => handlePalletDragStart(e, i)}
                                        className="w-full h-full flex flex-col justify-between bg-black/20 rounded p-1"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div onClick={(e) => cycleColor(e, i)} className={`w-3 h-3 rounded-full border cursor-pointer ${getBgColor(cell.color)}`}></div>
                                            <span className={`text-[9px] font-mono leading-none ${cell.count! >= MAX_PALLET ? 'text-green-400 animate-pulse' : 'text-neutral-400'}`}>
                                                {cell.count}
                                            </span>
                                        </div>
                                        <div className="h-1 bg-amber-800/80 w-full rounded-sm mt-auto"></div>
                                    </div>
                                )}

                                {/* BEWEGEND KRATJE (Overlay) */}
                                {cell.crate && cell.type !== 'rolltainer' && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                                        <div className={`w-6 h-6 rounded-sm shadow-md border border-white/40 ${getBgColor(cell.crate)}`}></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <p className="text-center text-xs text-neutral-500 mt-2">Klik op machines om te draaien (Cobot/Band/Sorter)</p>
        </div>

        {/* VERKOOP ZONE */}
        <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleTruckDrop}
            className="w-32 h-64 border-4 border-dashed border-neutral-600 rounded-xl bg-neutral-800/50 flex flex-col items-center justify-center text-center p-4 transition-colors hover:bg-neutral-700 hover:border-green-500"
        >
            <span className="text-4xl mb-4">🚛</span>
            <span className="text-xs font-bold text-neutral-300 uppercase leading-tight">Sleep Volle Pallets Hierheen</span>
        </div>

      </div>
    </div>
  );
}