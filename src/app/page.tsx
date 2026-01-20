"use client";
import React, { useState, useEffect, useCallback } from 'react';

// --- CONFIGURATIE & TYPES ---

const COLORS = ['red', 'blue', 'green', 'purple'];
const MAX_PALLET = 70;
const GRID_SIZE = 5; // 5x5 Grid
const TICK_SPEED = 800; // Snelheid van de lopende banden (ms)

// Definieer wat er in een vakje kan zitten (De TS Fix)
type StructureType = 'pallet' | 'conveyor' | 'sorter';

interface GridCell {
  id: string;
  type: StructureType;
  color?: string;       // Kleur van pallet of sorter-filter
  count?: number;       // Aantal kratten op pallet
  rotation?: number;    // 0=Boven, 1=Rechts, 2=Onder, 3=Links
  crate?: string | null; // De kleur van de krat die er OP ligt (transport)
}

interface ShopItem {
  type: StructureType;
  price: number;
  label: string;
  icon: string;
}

const SHOP_ITEMS: ShopItem[] = [
  { type: 'conveyor', price: 50, label: 'Band', icon: '⬆️' },
  { type: 'sorter', price: 150, label: 'Sorter', icon: '🔀' },
  { type: 'pallet', price: 100, label: 'Pallet', icon: '📦' },
];

export default function AutomationGame() {
  // --- STATE ---
  const [grid, setGrid] = useState<(GridCell | null)[]>(Array(GRID_SIZE * GRID_SIZE).fill(null));
  const [rolltainer, setRolltainer] = useState<string[]>([]); // Simpele stapel voor nu
  const [money, setMoney] = useState(600); // Startbudget
  const [score, setScore] = useState(0);
  
  // Interactie modus
  const [selectedShopItem, setSelectedShopItem] = useState<StructureType | null>(null);
  const [moveSourceIndex, setMoveSourceIndex] = useState<number | null>(null);
  const [isMoveMode, setIsMoveMode] = useState(false);

  // --- HULPFUNCTIES ---

  // Genereer een ID
  const uid = () => Math.random().toString(36).substr(2, 9);

  // Bereken index van buurman op basis van richting
  const getNeighborIndex = (index: number, direction: number = 0) => {
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

  // --- GAME LOOP (AUTOMATISERING) ---
  useEffect(() => {
    const interval = setInterval(() => {
      setGrid((currentGrid) => {
        const nextGrid = JSON.parse(JSON.stringify(currentGrid)); // Deep copy
        let changed = false;

        // We itereren 2x: eerst logica bepalen, dan uitvoeren om botsingen te voorkomen
        // Simpele versie: We verwerken cellen die een krat hebben
        
        // Stap 1: Loop door grid en verplaats kratten
        // We doen dit in omgekeerde volgorde om 'opstoppingen' iets beter te simuleren
        for (let i = 0; i < currentGrid.length; i++) {
          const cell = currentGrid[i];
          
          // Alleen actie als er een structuur is én er ligt een krat op (voor transport)
          if (cell && cell.crate) {
            
            // LOGICA PER TYPE
            let targetIndex: number | null = null;

            if (cell.type === 'conveyor') {
              // Beweeg in de richting van de pijl
              targetIndex = getNeighborIndex(i, cell.rotation);
            } else if (cell.type === 'sorter') {
              // Sorter logica: Match kleur -> Rechtdoor (rotatie), Anders -> Rechtsaf (rotatie + 1)
              if (cell.crate === cell.color) {
                targetIndex = getNeighborIndex(i, cell.rotation);
              } else {
                targetIndex = getNeighborIndex(i, (cell.rotation! + 1) % 4);
              }
            }

            // Als er een doel is, probeer te verplaatsen
            if (targetIndex !== null && targetIndex >= 0) {
              const targetCell = nextGrid[targetIndex];

              // SCENARIO A: Doel is een Pallet
              if (targetCell && targetCell.type === 'pallet') {
                if (targetCell.color === cell.crate && targetCell.count < MAX_PALLET) {
                  // Succesvolle opslag
                  targetCell.count++;
                  nextGrid[i].crate = null; // Verwijder van huidige band
                  changed = true;
                }
              }
              // SCENARIO B: Doel is een andere band/sorter (Transport)
              else if (targetCell && (targetCell.type === 'conveyor' || targetCell.type === 'sorter')) {
                // Alleen verplaatsen als doel leeg is
                if (!targetCell.crate) {
                  targetCell.crate = cell.crate;
                  nextGrid[i].crate = null;
                  changed = true;
                }
              }
            }
          }
        }
        
        // Controleer op volle pallets -> Auto sell als ze 70 halen? 
        // Laten we dat handmatig houden voor de 'game feel', of auto-cash voor flow.
        // Laten we auto-cash doen als bonus feature.
        nextGrid.forEach((cell: GridCell | null, idx: number) => {
           if (cell && cell.type === 'pallet' && cell.count! >= MAX_PALLET) {
               // Pallet vol!
               // Hier zou je hem leeg kunnen maken of wachten op speler.
               // We laten hem vol staan zodat speler hem moet slepen (zie drag/drop).
           }
        });

        return changed ? nextGrid : currentGrid;
      });
    }, TICK_SPEED);

    return () => clearInterval(interval);
  }, []);

  // Roltainer vullen
  useEffect(() => {
    if (rolltainer.length < 5) {
      const timer = setInterval(() => {
        setRolltainer(prev => [...prev, COLORS[Math.floor(Math.random() * COLORS.length)]]);
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [rolltainer]);


  // --- INTERACTIE HANDLERS ---

  const handleCellClick = (index: number) => {
    const cell = grid[index];

    // MODUS 1: Verplaatsen (Move Mode)
    if (isMoveMode) {
      if (moveSourceIndex === null) {
        if (cell) setMoveSourceIndex(index); // Selecteer bron
      } else {
        // Verplaats actie
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

    // MODUS 2: Shop / Bouwen
    if (selectedShopItem) {
      if (!cell) {
        // Kopen
        const item = SHOP_ITEMS.find(i => i.type === selectedShopItem);
        if (item && money >= item.price) {
          const newGrid = [...grid];
          newGrid[index] = {
            id: uid(),
            type: selectedShopItem,
            rotation: 1, // Standaard naar rechts
            color: selectedShopItem === 'pallet' ? 'red' : (selectedShopItem === 'sorter' ? 'red' : undefined),
            count: 0,
            crate: null
          };
          setGrid(newGrid);
          setMoney(m => m - item.price);
          setSelectedShopItem(null); // Deselecteer na bouwen
        }
      }
      return;
    }

    // MODUS 3: Configureren (Draaien / Kleur)
    if (cell) {
      const newGrid = [...grid];
      // Als sorter: Klik in midden verandert kleur, klik rand verandert rotatie?
      // Simpel: Klik is draaien, Shift+Klik (of rechtermuis) is kleur.
      // Voor mobiel vriendelijkheid: Klik = draaien. Dubbelklik = kleur (voor sorter/pallet).
      
      // We doen: Klik = Draaien. 
      // Er komt een apart knopje in de UI voor kleur.
      if (cell.type === 'conveyor' || cell.type === 'sorter') {
        newGrid[index] = { ...cell, rotation: (cell.rotation! + 1) % 4 };
        setGrid(newGrid);
      }
    }
  };

  // Aparte handler om kleur te cyclen
  const cycleColor = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const cell = grid[index];
    if (cell && (cell.type === 'sorter' || cell.type === 'pallet')) {
      const newGrid = [...grid];
      const currentColorIdx = COLORS.indexOf(cell.color || 'red');
      const nextColor = COLORS[(currentColorIdx + 1) % COLORS.length];
      newGrid[index] = { ...cell, color: nextColor };
      setGrid(newGrid);
    }
  };

  // Drag & Drop vanuit Roltainer
  const handleDragStart = (e: React.DragEvent, color: string) => {
    e.dataTransfer.setData("color", color);
    e.dataTransfer.setData("source", "rolltainer");
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const color = e.dataTransfer.getData("color");
    const source = e.dataTransfer.getData("source");
    
    if (source === "rolltainer") {
      const cell = grid[index];
      
      // Drop op Band of Sorter
      if (cell && (cell.type === 'conveyor' || cell.type === 'sorter') && !cell.crate) {
        const newGrid = [...grid];
        newGrid[index]!.crate = color;
        setGrid(newGrid);
        setRolltainer(prev => prev.slice(1)); // Verwijder bovenste uit roltainer
      }
      // Drop op Pallet
      else if (cell && cell.type === 'pallet') {
        if (cell.color === color && cell.count! < MAX_PALLET) {
          const newGrid = [...grid];
          newGrid[index]!.count!++;
          setGrid(newGrid);
          setRolltainer(prev => prev.slice(1));
        }
      }
    }

    // Drop van Pallet naar Truck (Verkoop)
    const type = e.dataTransfer.getData("type");
    if (type === 'full_pallet') {
        // Logic handled in Truck drop zone
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
          // Verkoop!
          newGrid[index] = null; // Pallet weg, ruimte vrij
          setGrid(newGrid);
          setMoney(m => m + 300);
          setScore(s => s + 1);
      }
  };

  // --- RENDERING HELPERS ---
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
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 flex flex-col items-center select-none">
      
      {/* HUD */}
      <div className="w-full max-w-4xl bg-slate-800 p-4 rounded-xl border-b-4 border-slate-600 mb-6 flex justify-between items-center shadow-lg sticky top-0 z-10">
        <div>
           <h1 className="text-xl font-black italic text-yellow-400">AUTO-LOGISTICS</h1>
           <p className="text-xs text-slate-400">Bouw een geautomatiseerd sorteersysteem</p>
        </div>
        <div className="flex gap-6 text-right">
            <div>
                <span className="block text-[10px] text-slate-400">GELD</span>
                <span className="text-2xl font-mono text-green-400">€{money}</span>
            </div>
             <div>
                <span className="block text-[10px] text-slate-400">VERKOCHT</span>
                <span className="text-2xl font-mono text-blue-400">{score}</span>
            </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full max-w-6xl">
        
        {/* SHOP LINKS */}
        <div className="flex flex-col gap-2 bg-slate-800 p-4 rounded-xl border border-slate-700 min-w-[150px]">
          <h2 className="font-bold text-slate-300 mb-2">🛒 SHOP</h2>
          {SHOP_ITEMS.map((item) => (
            <button
              key={item.type}
              onClick={() => { setSelectedShopItem(item.type); setIsMoveMode(false); }}
              className={`flex items-center justify-between p-3 rounded border-2 transition-all
                ${selectedShopItem === item.type ? 'border-yellow-400 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}
                ${money < item.price ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={money < item.price}
            >
              <div className="flex gap-2">
                  <span>{item.icon}</span>
                  <span className="text-sm font-bold">{item.label}</span>
              </div>
              <span className="text-xs text-green-400 font-mono">€{item.price}</span>
            </button>
          ))}
          
          <div className="h-px bg-slate-600 my-2"></div>
          
          <button
            onClick={() => { setIsMoveMode(!isMoveMode); setSelectedShopItem(null); setMoveSourceIndex(null); }}
            className={`p-3 rounded border-2 font-bold text-sm transition-all text-center
                ${isMoveMode ? 'bg-orange-500 border-orange-300 text-white animate-pulse' : 'bg-slate-700 border-slate-600 text-slate-300'}
            `}
          >
            {isMoveMode ? 'STOP VERPLAATSEN' : '🛠️ VERPLAATSEN'}
          </button>
          
          <div className="mt-4 p-2 bg-black/30 rounded text-xs text-slate-400">
             <p>💡 <b>Tip:</b> Klik op band/sorter om te draaien.</p>
             <p className="mt-1">💡 <b>Tip:</b> Klik op het gekleurde stipje om kleur te wijzigen.</p>
          </div>
        </div>

        {/* MIDDEN: GRID */}
        <div className="flex flex-col items-center">
            {/* INKOMENDE ROLLTAINER (Boven Grid) */}
            <div className="mb-4 flex gap-2 items-center bg-slate-800 px-4 py-2 rounded-lg border border-slate-600">
                <span className="text-xs font-bold text-slate-400">INKOMEND:</span>
                <div className="flex gap-2">
                    {rolltainer.map((c, i) => (
                        <div 
                            key={i} 
                            draggable={i === 0}
                            onDragStart={(e) => handleDragStart(e, c)}
                            className={`w-10 h-10 rounded border-2 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing
                                ${getBgColor(c)} ${i===0 ? 'scale-110 border-white z-10' : 'opacity-50 scale-90 border-transparent'}
                            `}
                        >
                            {i===0 && <span className="text-xs">📦</span>}
                        </div>
                    ))}
                    {rolltainer.length === 0 && <span className="text-xs italic text-slate-500">Wachten...</span>}
                </div>
            </div>

            {/* HET SPEELVELD (5x5) */}
            <div 
                className="grid grid-cols-5 gap-2 bg-slate-800 p-4 rounded-xl shadow-2xl border-4 border-slate-700"
                style={{ width: 'fit-content' }}
            >
                {grid.map((cell, i) => (
                    <div
                        key={i}
                        onClick={() => handleCellClick(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, i)}
                        className={`w-16 h-16 md:w-20 md:h-20 rounded border-2 relative flex items-center justify-center transition-all
                            ${!cell ? 'bg-slate-900 border-slate-800 hover:border-slate-600' : 'bg-slate-700 border-slate-500'}
                            ${isMoveMode && cell ? 'cursor-grab hover:scale-95 border-orange-400' : ''}
                            ${isMoveMode && !cell && moveSourceIndex !== null ? 'bg-green-900/30 border-green-500 cursor-pointer' : ''}
                            ${selectedShopItem && !cell ? 'hover:bg-green-900/20 cursor-pointer' : ''}
                        `}
                    >
                        {/* CELL INHOUD */}
                        {cell && (
                            <div className="w-full h-full relative">
                                
                                {/* CONVEYOR */}
                                {cell.type === 'conveyor' && (
                                    <div className={`w-full h-full flex items-center justify-center transition-transform duration-300 ${getRotationClass(cell.rotation)}`}>
                                        <div className="w-2 h-full bg-slate-500 absolute"></div>
                                        <div className="text-2xl animate-pulse text-slate-400">⬆</div>
                                    </div>
                                )}

                                {/* SORTER */}
                                {cell.type === 'sorter' && (
                                    <div className={`w-full h-full relative border-4 border-double border-slate-400 rounded transition-transform duration-300 ${getRotationClass(cell.rotation)}`}>
                                        {/* Pijlen */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 text-xs text-slate-400">⬆</div>
                                        <div className="absolute top-1/2 right-0 -translate-y-1/2 text-xs text-slate-400">➡</div>
                                        
                                        {/* Kleur indicator (Klikbaar) */}
                                        <div 
                                            onClick={(e) => cycleColor(e, i)}
                                            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 z-10 ${getBgColor(cell.color)}`}
                                            title="Klik om filterkleur te wijzigen"
                                        ></div>
                                    </div>
                                )}

                                {/* PALLET */}
                                {cell.type === 'pallet' && (
                                    <div 
                                        draggable={cell.count! >= MAX_PALLET}
                                        onDragStart={(e) => handlePalletDragStart(e, i)}
                                        className="w-full h-full p-1 flex flex-col justify-between"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div onClick={(e) => cycleColor(e, i)} className={`w-4 h-4 rounded-full border cursor-pointer ${getBgColor(cell.color)}`}></div>
                                            <span className={`text-[10px] font-mono ${cell.count! >= MAX_PALLET ? 'text-green-400 font-bold animate-pulse' : 'text-white'}`}>
                                                {cell.count}
                                            </span>
                                        </div>
                                        {/* Kratjes visual */}
                                        <div className="flex flex-wrap gap-0.5 justify-center content-end h-full">
                                            {Array.from({ length: Math.min(9, Math.ceil((cell.count || 0) / 8)) }).map((_, idx) => (
                                                <div key={idx} className={`w-3 h-3 rounded-sm ${getBgColor(cell.color)} opacity-80`}></div>
                                            ))}
                                        </div>
                                        <div className="h-1 bg-amber-700 w-full rounded-sm"></div>
                                    </div>
                                )}

                                {/* MOVING CRATE (Animatie laag er bovenop) */}
                                {cell.crate && (
                                    <div className={`absolute inset-0 flex items-center justify-center z-20 animate-bounce`}>
                                        <div className={`w-8 h-8 rounded shadow-lg border border-white ${getBgColor(cell.crate)}`}></div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Move Mode Highlight */}
                        {isMoveMode && moveSourceIndex === i && (
                           <div className="absolute inset-0 bg-orange-500/30 animate-pulse border-2 border-orange-500 z-30 pointer-events-none"></div> 
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* RECHTS: VERKOOP TRUCK */}
        <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleTruckDrop}
            className="w-32 h-64 border-4 border-dashed border-slate-600 rounded-xl bg-slate-800/50 flex flex-col items-center justify-center text-center p-4 transition-colors hover:bg-slate-700 hover:border-green-500"
        >
            <span className="text-4xl mb-2">🚛</span>
            <span className="text-xs font-bold text-slate-300 uppercase">Verkoop Volle Pallets</span>
            <div className="mt-4 text-[10px] text-slate-500">Sleep pallet (70st) hierheen</div>
        </div>

      </div>
    </div>
  );
}