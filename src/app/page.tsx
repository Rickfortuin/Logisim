"use client";
import React, { useState, useEffect } from 'react';

// --- CONFIGURATIE & TYPES ---

const COLORS = ['red', 'blue', 'green', 'purple'];
const MAX_PALLET = 10;
const GRID_SIZE = 8;
const TICK_SPEED = 800;

type StructureType = 'pallet' | 'conveyor' | 'sorter' | 'rolltainer' | 'cobot';

interface GridCell {
  id: string;
  type: StructureType;
  color?: string;
  count?: number;
  rotation?: number;
  crate?: string | null;
}

interface ShopItem {
  type: StructureType;
  price: number;
  label: string;
  icon: string;
  desc: string;
}

const SHOP_ITEMS: ShopItem[] = [
  { type: 'conveyor', price: 50, label: 'Transportband', icon: '⬆️', desc: 'Transport' },
  { type: 'sorter', price: 150, label: 'Sorteermachine', icon: '🔀', desc: 'Sorteert op kleur' },
  { type: 'pallet', price: 100, label: 'Opslagpallet', icon: '📦', desc: 'Opslag' },
  { type: 'cobot', price: 300, label: 'Robotarm', icon: '🦾', desc: 'Automatische handling' },
];

interface IncomingTruck {
  id: string;
  cargo: number; // aantal rolltainers
}

export default function WarenhuisSim() {
  const [grid, setGrid] = useState<(GridCell | null)[]>(Array(GRID_SIZE * GRID_SIZE).fill(null));
  const [money, setMoney] = useState(1000);
  const [score, setScore] = useState(0);
  
  const [selectedShopItem, setSelectedShopItem] = useState<StructureType | null>(null);
  const [moveSourceIndex, setMoveSourceIndex] = useState<number | null>(null);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [incomingTrucks, setIncomingTrucks] = useState<IncomingTruck[]>([
    { id: 'truck-1', cargo: 4 },
    { id: 'truck-2', cargo: 3 },
    { id: 'truck-3', cargo: 2 },
  ]);

  const uid = () => Math.random().toString(36).substr(2, 9);

  const getNeighborIndex = (index: number, direction: number) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    let nextRow = row; let nextCol = col;
    if (direction === 0) nextRow--; 
    if (direction === 1) nextCol++; 
    if (direction === 2) nextRow++; 
    if (direction === 3) nextCol--; 
    if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) return null;
    return nextRow * GRID_SIZE + nextCol;
  };

  // --- TRUCK LOGICA ---
  const addRolltainerFromTruck = (truckId: string) => {
    const truckIndex = incomingTrucks.findIndex(t => t.id === truckId);
    if (truckIndex === -1 || incomingTrucks[truckIndex].cargo <= 0) return;

    // Zoek een lege plek in de meest linkse kolom
    for (let row = 0; row < GRID_SIZE; row++) {
      const index = row * GRID_SIZE; // Eerste kolom (index 0)
      if (!grid[index]) {
        const newGrid = [...grid];
        newGrid[index] = {
          id: uid(),
          type: 'rolltainer',
          crate: null
        };
        setGrid(newGrid);
        
        // Verminder truck cargo
        const updatedTrucks = [...incomingTrucks];
        updatedTrucks[truckIndex] = {
          ...updatedTrucks[truckIndex],
          cargo: updatedTrucks[truckIndex].cargo - 1
        };
        setIncomingTrucks(updatedTrucks);
        return;
      }
    }
  };

  // --- GAME LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
      setGrid((currentGrid) => {
        const nextGrid = JSON.parse(JSON.stringify(currentGrid));
        let changed = false;

        // Rolltainers genereren pakketten
        for (let i = 0; i < currentGrid.length; i++) {
          const cell = nextGrid[i];
          if (cell && cell.type === 'rolltainer' && !cell.crate) {
            if (Math.random() > 0.7) { // Minder vaak genereren
              cell.crate = COLORS[Math.floor(Math.random() * COLORS.length)];
              changed = true;
            }
          }
        }

        // Cobot logica
        for (let i = 0; i < currentGrid.length; i++) {
          const cobot = currentGrid[i];
          if (cobot && cobot.type === 'cobot') {
            const isVertical = cobot.rotation === 0 || cobot.rotation === 2;
            const sideA = getNeighborIndex(i, isVertical ? 0 : 3);
            const sideB = getNeighborIndex(i, isVertical ? 2 : 1);
            const idxs = [sideA, sideB];
            let sourceIdx = -1; let targetIdx = -1;

            if (idxs[0] !== null && nextGrid[idxs[0]]?.type === 'rolltainer' && nextGrid[idxs[0]]?.crate) sourceIdx = idxs[0]!;
            else if (idxs[1] !== null && nextGrid[idxs[1]]?.type === 'rolltainer' && nextGrid[idxs[1]]?.crate) sourceIdx = idxs[1]!;

            if (sourceIdx !== -1) {
              const potentialTarget = sourceIdx === idxs[0] ? idxs[1] : idxs[0];
              if (potentialTarget !== null) {
                const targetCell = nextGrid[potentialTarget];
                if (targetCell && targetCell.type === 'conveyor' && !targetCell.crate) {
                  targetIdx = potentialTarget;
                }
              }
            }
            if (sourceIdx !== -1 && targetIdx !== -1) {
              nextGrid[targetIdx].crate = nextGrid[sourceIdx].crate;
              nextGrid[sourceIdx].crate = null;
              changed = true;
            }
          }
        }

        // Conveyor en sorter logica
        for (let i = 0; i < currentGrid.length; i++) {
          const cell = currentGrid[i];
          if (cell && (cell.type === 'conveyor' || cell.type === 'sorter') && cell.crate) {
            let targetIndex: number | null = null;
            if (cell.type === 'conveyor') {
              targetIndex = getNeighborIndex(i, cell.rotation!);
            } else if (cell.type === 'sorter') {
              if (cell.crate === cell.color) {
                targetIndex = getNeighborIndex(i, cell.rotation!);
              } else {
                targetIndex = getNeighborIndex(i, (cell.rotation! + 1) % 4);
              }
            }
            if (targetIndex !== null && targetIndex >= 0) {
              const targetCell = nextGrid[targetIndex];
              if (targetCell && targetCell.type === 'pallet') {
                if (targetCell.color === cell.crate && targetCell.count! < MAX_PALLET) {
                  targetCell.count!++;
                  nextGrid[i].crate = null;
                  changed = true;
                }
              }
              else if (targetCell && (targetCell.type === 'conveyor' || targetCell.type === 'sorter')) {
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

  // --- UI HANDLERS ---
  const handleCellClick = (index: number) => {
    const cell = grid[index];
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

    if (selectedShopItem) {
      if (!cell) {
        const item = SHOP_ITEMS.find(i => i.type === selectedShopItem);
        if (item && money >= item.price) {
          const newGrid = [...grid];
          newGrid[index] = {
            id: uid(),
            type: selectedShopItem,
            rotation: (selectedShopItem === 'cobot') ? 0 : 1,
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

    if (cell) {
      const newGrid = [...grid];
      if (cell.type === 'cobot') {
        newGrid[index] = { ...cell, rotation: cell.rotation === 0 ? 1 : 0 };
        setGrid(newGrid);
        return;
      }
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
    if (cell && cell.type === 'pallet' && cell.count! >= MAX_PALLET) {
      e.dataTransfer.setData("type", "full_pallet");
      e.dataTransfer.setData("index", index.toString());
    }
  };

  const handleTruckDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    if (type === 'full_pallet') {
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
    switch (rot) {
      case 0: return 'rotate-0';
      case 1: return 'rotate-90';
      case 2: return 'rotate-180';
      case 3: return '-rotate-90';
      default: return '';
    }
  };

  const getBgColor = (c?: string) => {
    if (c === 'red') return 'bg-red-500';
    if (c === 'blue') return 'bg-blue-500';
    if (c === 'green') return 'bg-green-500';
    if (c === 'purple') return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const getTextColor = (c?: string) => {
    if (c === 'red') return 'text-red-500';
    if (c === 'blue') return 'text-blue-500';
    if (c === 'green') return 'text-green-500';
    if (c === 'purple') return 'text-purple-500';
    return 'text-neutral-400';
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans p-4 flex flex-col items-center select-none">
      {/* HEADER */}
      <div className="w-full max-w-7xl flex justify-between items-center bg-neutral-800 p-4 rounded-xl border-b-4 border-neutral-700 mb-4 sticky top-0 z-20 shadow-lg">
        <div>
          <h1 className="text-xl font-black text-orange-500">DISTRIBUTIECENTRUM SIMULATOR</h1>
          <p className="text-xs text-neutral-400">Ontwerp je logistiek proces</p>
        </div>
        <div className="flex gap-8">
          <div className="text-right">
            <span className="block text-[10px] text-neutral-400">BUDGET</span>
            <span className="text-2xl font-mono text-green-400">€{money}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-neutral-400">VERZONDEN</span>
            <span className="text-2xl font-mono text-blue-400">{score}</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-col xl:flex-row gap-6 items-start justify-center w-full max-w-7xl">
        
        {/* LINKERKANT: TRUCKS EN SHOP */}
        <div className="flex flex-col gap-6 w-full xl:w-auto">
          {/* INKOMENDE TRUCKS */}
          <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700 min-w-[200px]">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-neutral-600">
              <h2 className="font-bold text-neutral-300">INKOMENDE TRUCKS</h2>
              <span className="text-xs text-neutral-400">Lading: {incomingTrucks.reduce((sum, t) => sum + t.cargo, 0)}</span>
            </div>
            <div className="flex flex-col gap-3">
              {incomingTrucks.map((truck) => (
                <div
                  key={truck.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${truck.cargo > 0 ? 'border-green-500/50 bg-green-900/20 hover:bg-green-900/30' : 'border-neutral-600 bg-neutral-900/50'}`}
                  onClick={() => truck.cargo > 0 && addRolltainerFromTruck(truck.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🚚</div>
                    <div>
                      <div className="font-medium text-sm">Vrachtwagen</div>
                      <div className="text-xs text-neutral-400">
                        {truck.cargo > 0 ? `${truck.cargo} rolltainers` : 'Leeg'}
                      </div>
                    </div>
                  </div>
                  {truck.cargo > 0 ? (
                    <button className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded transition-colors">
                      Laad uit
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-500">Klaar</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-3 text-center">
              Klik op truck om rolltainer te plaatsen
            </p>
          </div>

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
                {isMoveMode ? 'STOP VERPLAATSEN' : '🛠️ VERPLAATS MODUS'}
              </button>
            </div>
          </div>
        </div>

        {/* CENTRUM: DISTRIBUTIEGRID */}
        <div className="bg-neutral-800 p-4 rounded-xl shadow-2xl border-4 border-neutral-700 overflow-auto">
          {/* WAREHOUSE LABELS */}
          <div className="flex justify-between items-center mb-2 px-2">
            <div className="text-xs text-green-400 font-bold">INLADING</div>
            <div className="text-xs text-blue-400 font-bold">SORTERING</div>
            <div className="text-xs text-amber-400 font-bold">OPSLAG</div>
          </div>
          
          <div 
            className="grid grid-cols-8 gap-1 relative"
            style={{ width: 'fit-content' }}
          >
            {/* GRID ACHTERGROND PATROON */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
            
            {grid.map((cell, i) => {
              const row = Math.floor(i / GRID_SIZE);
              const col = i % GRID_SIZE;
              const isEntryPoint = col === 0;
              
              return (
                <div
                  key={i}
                  onClick={() => handleCellClick(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleTruckDrop}
                  className={`w-14 h-14 md:w-16 md:h-16 rounded border relative flex items-center justify-center transition-all
                    ${!cell ? 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-600' : 'bg-neutral-700/90 border-neutral-600'}
                    ${isMoveMode && cell ? 'cursor-grab hover:brightness-110 border-orange-400' : ''}
                    ${selectedShopItem && !cell ? 'hover:bg-green-900/30 cursor-pointer' : ''}
                    ${isEntryPoint ? 'border-l-2 border-l-green-500/50' : ''}
                  `}
                >
                  {cell ? (
                    <div className="w-full h-full relative p-1">
                      {/* ROLLTAINER */}
                      {cell.type === 'rolltainer' && (
                        <div className="w-full h-full border-2 border-dashed border-zinc-400 rounded bg-zinc-800/90 flex items-center justify-center relative">
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
                          <div className="w-2 h-full bg-slate-500 rounded-full absolute opacity-50"></div>
                          <div className="w-full h-2 bg-slate-400 absolute"></div>
                          <div className="z-10 w-8 h-8 rounded-full bg-slate-300 border-4 border-slate-500 flex items-center justify-center shadow-lg">
                            <span className="text-sm">🦾</span>
                          </div>
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
                          <div 
                            onClick={(e) => cycleColor(e, i)}
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full border border-white shadow-sm cursor-pointer hover:scale-110 z-30 ${getBgColor(cell.color)}`}
                          ></div>
                          <span className={`absolute top-0 left-1/2 -translate-x-1/2 text-lg font-bold ${getTextColor(cell.color)}`}>⬆</span>
                          <span className="absolute top-1/2 right-0 -translate-y-1/2 text-[8px] text-neutral-400">➡</span>
                          <div className="absolute inset-2 border border-neutral-500 opacity-20 rounded-sm"></div>
                        </div>
                      )}

                      {/* PALLET */}
                      {cell.type === 'pallet' && (
                        <div 
                          draggable={cell.count! >= MAX_PALLET}
                          onDragStart={(e) => handlePalletDragStart(e, i)}
                          className="w-full h-full flex flex-col justify-between bg-black/20 rounded p-1"
                        >
                          <div className="flex justify-between items-start relative h-full">
                            <div 
                              onClick={(e) => cycleColor(e, i)} 
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full border border-white shadow-sm cursor-pointer z-30 ${getBgColor(cell.color)}`}
                            ></div>
                            <span className={`text-[9px] font-mono absolute top-0 right-0 ${cell.count! >= MAX_PALLET ? 'text-green-400 animate-pulse' : 'text-neutral-400'}`}>
                              {cell.count}
                            </span>
                          </div>
                          <div className="h-1 bg-amber-800/80 w-full rounded-sm mt-auto"></div>
                        </div>
                      )}

                      {/* BEWEGEND KRATJE */}
                      {cell.crate && cell.type !== 'rolltainer' && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                          <div className={`w-6 h-6 rounded-sm shadow-md border border-white/40 animate-pulse ${getBgColor(cell.crate)}`}></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    isEntryPoint && (
                      <div className="text-[8px] text-green-400/50 absolute bottom-1">IN</div>
                    )
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-neutral-500 mt-2">Klik op machines om te draaien • Sleep volle pallets naar uitlaadzone</p>
        </div>

        {/* RECHTERKANT: UITLADING */}
        <div className="flex flex-col gap-4">
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleTruckDrop}
            className="w-32 h-48 border-4 border-dashed border-neutral-600 rounded-xl bg-neutral-800/50 flex flex-col items-center justify-center text-center p-4 transition-all hover:bg-neutral-700 hover:border-green-500 hover:shadow-lg hover:scale-[1.02]"
          >
            <span className="text-4xl mb-4 animate-bounce">🚛</span>
            <span className="text-xs font-bold text-neutral-300 uppercase leading-tight">UITLAADZONE</span>
            <span className="text-[10px] text-neutral-400 mt-2">Sleep volle pallets hierheen voor verzending</span>
            <div className="mt-4 text-sm font-mono text-green-400">€350 per pallet</div>
          </div>
          
          {/* STATISTIEKEN */}
          <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700 w-32">
            <h3 className="font-bold text-neutral-300 mb-3 text-sm border-b border-neutral-600 pb-2">STATUS</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">Actief:</span>
                <span className="text-xs font-mono text-green-400">
                  {grid.filter(c => c !== null).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">Rolltainers:</span>
                <span className="text-xs font-mono text-blue-400">
                  {grid.filter(c => c?.type === 'rolltainer').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">Volle pallets:</span>
                <span className="text-xs font-mono text-amber-400">
                  {grid.filter(c => c?.type === 'pallet' && c.count! >= MAX_PALLET).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* FOOTER INFO */}
      <div className="mt-6 text-center text-xs text-neutral-500 max-w-2xl">
        <p>Distributiecentrum Simulator • Plaats rolltainers aan de linkerkant • Ontwerp je sorteersysteem • Verzend volle pallets voor winst</p>
      </div>
    </div>
  );
}