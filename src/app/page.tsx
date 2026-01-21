"use client";
import React, { useState, useEffect, useCallback } from 'react';

// --- CONFIGURATIE & TYPES ---

const COLORS = ['red', 'blue', 'green', 'purple'];
const MAX_PALLET = 10;
const GRID_SIZE = 8;
const TICK_SPEED = 800;

type StructureType = 'pallet' | 'conveyor' | 'sorter' | 'rolltainer' | 'cobot' | 'orderdesk';
type Direction = 'up' | 'down' | 'left' | 'right';

interface GridCell {
  id: string;
  type: StructureType;
  color?: string;
  count?: number;
  rotation?: number;
  crate?: string | null;
}

interface Player {
  x: number;
  y: number;
  direction: Direction;
  carrying: string | null; // color of carried item
  speed: number;
}

interface Order {
  id: string;
  items: { color: string; quantity: number }[];
  address: string;
  reward: number;
  status: 'pending' | 'collecting' | 'delivering' | 'completed';
  collectedItems: { [color: string]: number };
}

interface ShopItem {
  type: StructureType;
  price: number;
  label: string;
  icon: string;
  desc: string;
}

// Stad adressen voor orders
const ADDRESSES = [
  'Havenstraat 15', 'Marktplein 8', 'Industrieweg 42', 'Kanaaldijk 3',
  'Dorpsstraat 27', 'Grachtweg 12', 'Winkelcentrum 5', 'Laan van Europa 33'
];

const SHOP_ITEMS: ShopItem[] = [
  { type: 'conveyor', price: 100, label: 'Transportband', icon: '⬆️', desc: 'Automatisch transport' },
  { type: 'sorter', price: 250, label: 'Sorteermachine', icon: '🔀', desc: 'Sorteert op kleur' },
  { type: 'pallet', price: 150, label: 'Opslagpallet', icon: '📦', desc: 'Opslag voor orders' },
  { type: 'cobot', price: 400, label: 'Robotarm', icon: '🦾', desc: 'Automatische handling' },
  { type: 'orderdesk', price: 200, label: 'Order Station', icon: '📋', desc: 'Genereert nieuwe orders' },
];

export default function WarehouseGame() {
  // --- STATES ---
  const [grid, setGrid] = useState<(GridCell | null)[]>(() => {
    const initial = Array(GRID_SIZE * GRID_SIZE).fill(null);
    // Start met een paar basis elementen
    initial[0] = { id: 'desk1', type: 'orderdesk' };
    initial[3] = { id: 'roll1', type: 'rolltainer', crate: null };
    initial[4] = { id: 'roll2', type: 'rolltainer', crate: null };
    initial[10] = { id: 'conv1', type: 'conveyor', rotation: 1 };
    return initial;
  });
  
  const [player, setPlayer] = useState<Player>({
    x: 2,
    y: 2,
    direction: 'right',
    carrying: null,
    speed: 300
  });
  
  const [money, setMoney] = useState(1500);
  const [score, setScore] = useState(0);
  const [orders, setOrders] = useState<Order[]>([
    {
      id: 'order1',
      items: [{ color: 'red', quantity: 2 }, { color: 'blue', quantity: 1 }],
      address: 'Marktplein 8',
      reward: 450,
      status: 'collecting',
      collectedItems: { red: 0, blue: 0 }
    }
  ]);
  
  const [selectedShopItem, setSelectedShopItem] = useState<StructureType | null>(null);
  const [moveSourceIndex, setMoveSourceIndex] = useState<number | null>(null);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [activeOrder, setActiveOrder] = useState<string | null>('order1');
  const [gameSpeed, setGameSpeed] = useState(1);

  const uid = () => Math.random().toString(36).substr(2, 9);

  // --- PLAYER CONTROLS ---
  const movePlayer = useCallback((dx: number, dy: number) => {
    setPlayer(prev => {
      const newX = Math.max(0, Math.min(GRID_SIZE - 1, prev.x + dx));
      const newY = Math.max(0, Math.min(GRID_SIZE - 1, prev.y + dy));
      
      // Update direction
      let newDirection = prev.direction;
      if (dx > 0) newDirection = 'right';
      if (dx < 0) newDirection = 'left';
      if (dy > 0) newDirection = 'down';
      if (dy < 0) newDirection = 'up';
      
      return {
        ...prev,
        x: newX,
        y: newY,
        direction: newDirection
      };
    });
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'ArrowUp') movePlayer(0, -1);
      if (e.key === 's' || e.key === 'ArrowDown') movePlayer(0, 1);
      if (e.key === 'a' || e.key === 'ArrowLeft') movePlayer(-1, 0);
      if (e.key === 'd' || e.key === 'ArrowRight') movePlayer(1, 0);
      
      // Interactie met spatie
      if (e.key === ' ') {
        handlePlayerInteract();
      }
      
      // Cancel acties met Escape
      if (e.key === 'Escape') {
        setSelectedShopItem(null);
        setIsMoveMode(false);
        setMoveSourceIndex(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer]);

  // --- GAME LOGICA ---
  const getNeighborIndex = (index: number, direction: number) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    let nextRow = row; let nextCol = col;
    if (direction === 0) nextRow--; // up
    if (direction === 1) nextCol++; // right
    if (direction === 2) nextRow++; // down
    if (direction === 3) nextCol--; // left
    if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) return null;
    return nextRow * GRID_SIZE + nextCol;
  };

  const playerIndex = player.y * GRID_SIZE + player.x;

  // Player interactie
  const handlePlayerInteract = () => {
    const cell = grid[playerIndex];
    
    // Orderdesk - accepteer nieuwe order
    if (cell?.type === 'orderdesk') {
      generateNewOrder();
      return;
    }
    
    // Rolltainer - pak pakket
    if (cell?.type === 'rolltainer' && cell.crate && !player.carrying) {
      setPlayer(prev => ({ ...prev, carrying: cell.crate ?? null }));
      const newGrid = [...grid];
      newGrid[playerIndex] = { ...cell, crate: null };
      setGrid(newGrid);
      return;
    }
    
    // Pallet - plaats pakket voor order
    if (cell?.type === 'pallet' && player.carrying && activeOrder) {
      const order = orders.find(o => o.id === activeOrder);
      if (order && cell.color === player.carrying) {
        // Check of deze kleur nodig is voor de order
        const neededItem = order.items.find(item => item.color === player.carrying);
        if (neededItem && (order.collectedItems[player.carrying] || 0) < neededItem.quantity) {
          // Update collected items
          const updatedOrders = orders.map(o => {
            if (o.id === activeOrder) {
              const newCollected = { ...o.collectedItems };
              newCollected[player.carrying!] = (newCollected[player.carrying!] || 0) + 1;
              return { ...o, collectedItems: newCollected };
            }
            return o;
          });
          setOrders(updatedOrders);
          
          // Update pallet count
          const newGrid = [...grid];
          newGrid[playerIndex] = { 
            ...cell, 
            count: (cell.count || 0) + 1 
          };
          setGrid(newGrid);
          
          setPlayer(prev => ({ ...prev, carrying: null }));
          
          // Check of order compleet is
          checkOrderComplete(activeOrder, updatedOrders);
        }
      }
      return;
    }
    
    // Conveyor/Sorter - plaats pakket
    if ((cell?.type === 'conveyor' || cell?.type === 'sorter') && player.carrying && !cell.crate) {
      const newGrid = [...grid];
      newGrid[playerIndex] = { ...cell, crate: player.carrying };
      setGrid(newGrid);
      setPlayer(prev => ({ ...prev, carrying: null }));
      return;
    }
    
    // Pak pakket van conveyor/sorter
    if ((cell?.type === 'conveyor' || cell?.type === 'sorter') && cell.crate && !player.carrying) {
      setPlayer(prev => ({ ...prev, carrying: cell.crate ?? null }));
      const newGrid = [...grid];
      newGrid[playerIndex] = { ...cell, crate: null };
      setGrid(newGrid);
      return;
    }
  };

  const generateNewOrder = () => {
    const newOrder: Order = {
      id: uid(),
      items: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => ({
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        quantity: Math.floor(Math.random() * 3) + 1
      })),
      address: ADDRESSES[Math.floor(Math.random() * ADDRESSES.length)],
      reward: Math.floor(Math.random() * 400) + 300,
      status: 'collecting',
      collectedItems: {}
    };
    
    setOrders(prev => [...prev, newOrder]);
    if (!activeOrder) setActiveOrder(newOrder.id);
  };

  const checkOrderComplete = (orderId: string, currentOrders: Order[]) => {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const isComplete = order.items.every(item => 
      (order.collectedItems[item.color] || 0) >= item.quantity
    );
    
    if (isComplete) {
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: 'delivering' } : o
      ));
      setMoney(m => m + order.reward);
      setScore(s => s + 1);
      
      // Reset pallets voor deze order
      setGrid(prev => prev.map(cell => {
        if (cell?.type === 'pallet' && cell.color && order.items.some(item => item.color === cell.color)) {
          return { ...cell, count: 0 };
        }
        return cell;
      }));
    }
  };

  const deliverOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, status: 'completed' } : o
    ));
    
    // Bonus voor snelle levering
    setMoney(m => m + 100);
    setActiveOrder(null);
  };

  // --- AUTOMATISERING SYSTEMS ---
  useEffect(() => {
    const interval = setInterval(() => {
      setGrid((currentGrid) => {
        const nextGrid = JSON.parse(JSON.stringify(currentGrid));
        let changed = false;

        // Rolltainers genereren pakketten
        for (let i = 0; i < currentGrid.length; i++) {
          const cell = nextGrid[i];
          if (cell && cell.type === 'rolltainer' && !cell.crate) {
            if (Math.random() > 0.7) {
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

        // Conveyor en sorter automatische beweging
        for (let i = 0; i < currentGrid.length; i++) {
          const cell = currentGrid[i];
          if (cell && (cell.type === 'conveyor' || cell.type === 'sorter') && cell.crate) {
            let targetIndex: number | null = null;
            if (cell.type === 'conveyor') {
              targetIndex = getNeighborIndex(i, cell.rotation || 1);
            } else if (cell.type === 'sorter') {
              if (cell.crate === cell.color) {
                targetIndex = getNeighborIndex(i, cell.rotation || 0);
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
    }, TICK_SPEED / gameSpeed);
    return () => clearInterval(interval);
  }, [gameSpeed]);

  // --- GRID INTERACTIE ---
  const handleCellClick = (index: number) => {
    const cell = grid[index];
    
    // Niet klikken als speler erop staat
    if (index === playerIndex) return;
    
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
            color: (selectedShopItem === 'pallet' || selectedShopItem === 'sorter') ? COLORS[0] : undefined,
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
      const currentColorIdx = COLORS.indexOf(cell.color || COLORS[0]);
      newGrid[index] = { ...cell, color: COLORS[(currentColorIdx + 1) % COLORS.length] };
      setGrid(newGrid);
    }
  };

  // --- VISUAL HELPERS ---
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

  const getPlayerDirectionChar = (dir: Direction) => {
    switch (dir) {
      case 'up': return '▲';
      case 'down': return '▼';
      case 'left': return '◀';
      case 'right': return '▶';
    }
  };

  // --- UI RENDERING ---
  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans p-4 flex flex-col items-center select-none">
      {/* HEADER */}
      <div className="w-full max-w-7xl flex justify-between items-center bg-neutral-800 p-4 rounded-xl border-b-4 border-neutral-700 mb-4 sticky top-0 z-20 shadow-lg">
        <div>
          <h1 className="text-xl font-black text-orange-500">WAREHOUSE MANAGER</h1>
          <p className="text-xs text-neutral-400">Handmatig besturen + Automatiseren</p>
        </div>
        <div className="flex gap-6 items-center">
          <div className="text-right">
            <span className="block text-[10px] text-neutral-400">GELD</span>
            <span className="text-2xl font-mono text-green-400">€{money}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-neutral-400">ORDERS</span>
            <span className="text-2xl font-mono text-blue-400">{score}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setGameSpeed(1)}
              className={`px-3 py-1 rounded text-sm ${gameSpeed === 1 ? 'bg-blue-600' : 'bg-neutral-700'}`}
            >
              1x
            </button>
            <button
              onClick={() => setGameSpeed(2)}
              className={`px-3 py-1 rounded text-sm ${gameSpeed === 2 ? 'bg-blue-600' : 'bg-neutral-700'}`}
            >
              2x
            </button>
            <button
              onClick={() => setGameSpeed(3)}
              className={`px-3 py-1 rounded text-sm ${gameSpeed === 3 ? 'bg-blue-600' : 'bg-neutral-700'}`}
            >
              3x
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl">
        
        {/* LINKERKANT - PLAYER & CONTROLS */}
        <div className="flex flex-col gap-4 w-full lg:w-80">
          {/* PLAYER INFO */}
          <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-neutral-300">JIJ</h2>
              <div className={`px-2 py-1 rounded text-xs ${player.carrying ? 'bg-green-600' : 'bg-neutral-700'}`}>
                {player.carrying ? `Draagt: ${player.carrying}` : 'Leeg'}
              </div>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">
                {getPlayerDirectionChar(player.direction)}
              </div>
              <div>
                <div className="text-sm">Positie: ({player.x}, {player.y})</div>
                <div className="text-xs text-neutral-400">Gebruik WASD of pijltjes</div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>SPATIE - Interact met object</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>ESC - Cancel actie</span>
              </div>
            </div>
          </div>

          {/* ORDERS */}
          <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700 flex-1">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-neutral-300">ACTIEVE ORDERS</h2>
              <button
                onClick={generateNewOrder}
                className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded transition-colors"
              >
                + Nieuwe
              </button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {orders.filter(o => o.status !== 'completed').map((order) => (
                <div
                  key={order.id}
                  className={`p-3 rounded-lg border ${order.id === activeOrder ? 'border-orange-500 bg-neutral-700' : 'border-neutral-600 bg-neutral-800/50'}`}
                  onClick={() => setActiveOrder(order.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-sm">Naar: {order.address}</div>
                      <div className="text-xs text-neutral-400">€{order.reward}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      order.status === 'collecting' ? 'bg-blue-600' :
                      order.status === 'delivering' ? 'bg-yellow-600' :
                      'bg-green-600'
                    }`}>
                      {order.status === 'collecting' ? 'Verzamelen' :
                       order.status === 'delivering' ? 'Leveren' : 'Voltooid'}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getBgColor(item.color)}`}></div>
                          <span>{item.color}: {item.quantity}x</span>
                        </div>
                        <span className={order.collectedItems[item.color] >= item.quantity ? 'text-green-400' : 'text-neutral-400'}>
                          {order.collectedItems[item.color] || 0}/{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {order.status === 'delivering' && (
                    <button
                      onClick={() => deliverOrder(order.id)}
                      className="w-full mt-3 bg-green-600 hover:bg-green-700 py-1 rounded text-sm transition-colors"
                    >
                      Lever Af (+€100 bonus)
                    </button>
                  )}
                </div>
              ))}
              
              {orders.filter(o => o.status !== 'completed').length === 0 && (
                <div className="text-center text-neutral-500 py-4">
                  Geen actieve orders. Klik op "+ Nieuwe" of ga naar het Order Station
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTRUM - GAME GRID */}
        <div className="flex-1">
          <div className="bg-neutral-800 p-4 rounded-xl shadow-2xl border-4 border-neutral-700">
            <div className="flex justify-between items-center mb-3 px-2">
              <div className="text-xs text-green-400 font-bold">INLADING</div>
              <div className="text-xs text-blue-400 font-bold">SORTERING</div>
              <div className="text-xs text-amber-400 font-bold">OPSLAG</div>
            </div>
            
            <div 
              className="grid grid-cols-8 gap-1 relative mx-auto"
              style={{ width: 'fit-content' }}
            >
              {/* GRID ACHTERGROND */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
              
              {grid.map((cell, i) => {
                const isPlayerHere = i === playerIndex;
                
                return (
                  <div
                    key={i}
                    onClick={() => handleCellClick(i)}
                    className={`w-14 h-14 md:w-16 md:h-16 rounded border relative flex items-center justify-center transition-all
                      ${!cell ? 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-600' : 'bg-neutral-700/90 border-neutral-600'}
                      ${isMoveMode && cell ? 'cursor-grab hover:brightness-110 border-orange-400' : ''}
                      ${selectedShopItem && !cell && !isPlayerHere ? 'hover:bg-green-900/30 cursor-pointer' : ''}
                      ${isPlayerHere ? 'border-2 border-white shadow-lg' : ''}
                    `}
                  >
                    {/* PLAYER */}
                    {isPlayerHere && (
                      <div className="absolute inset-0 z-40 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-xl animate-pulse">
                          <span className="text-xl">{getPlayerDirectionChar(player.direction)}</span>
                          {player.carrying && (
                            <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${getBgColor(player.carrying)}`}></div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {cell && !isPlayerHere && (
                      <div className="w-full h-full relative p-1">
                        {/* ORDERDESK */}
                        {cell.type === 'orderdesk' && (
                          <div className="w-full h-full border-2 border-dashed border-blue-400 rounded bg-blue-900/30 flex items-center justify-center relative">
                            <span className="absolute -top-2 -right-1 text-[8px] bg-blue-600 px-1 rounded text-white">📋</span>
                            <span className="text-2xl">📋</span>
                          </div>
                        )}
                        
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
                          <div className="w-full h-full flex flex-col justify-between bg-black/20 rounded p-1">
                            <div className="flex justify-between items-start relative h-full">
                              <div 
                                onClick={(e) => cycleColor(e, i)} 
                                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full border border-white shadow-sm cursor-pointer z-30 ${getBgColor(cell.color)}`}
                              ></div>
                              <span className={`text-[9px] font-mono absolute top-0 right-0 ${cell.count! >= MAX_PALLET ? 'text-green-400 animate-pulse' : 'text-neutral-400'}`}>
                                {cell.count || 0}
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
                    )}
                  </div>
                );
              })}
            </div>
            
            <p className="text-center text-xs text-neutral-500 mt-3">
              WASD bewegen • SPATIE interacteren • Klik machines om te draaien
            </p>
          </div>
        </div>

        {/* RECHTERKANT - SHOP & AUTOMATISERING */}
        <div className="flex flex-col gap-4 w-full lg:w-80">
          {/* SHOP */}
          <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700">
            <h2 className="font-bold text-neutral-300 mb-3 border-b border-neutral-600 pb-2">AUTOMATISERING</h2>
            <div className="space-y-2">
              {SHOP_ITEMS.map((item) => (
                <button
                  key={item.type}
                  onClick={() => { setSelectedShopItem(item.type); setIsMoveMode(false); }}
                  className={`flex flex-col p-2 rounded border transition-all text-left w-full
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
                <p className="text-xs text-neutral-400 mt-2 text-center">
                  Klik een object en dan een lege plek om te verplaatsen
                </p>
              </div>
            </div>
          </div>

          {/* STATISTIEKEN */}
          <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700">
            <h3 className="font-bold text-neutral-300 mb-3 text-sm border-b border-neutral-600 pb-2">STATISTIEKEN</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">Automatische machines:</span>
                <span className="text-xs font-mono text-blue-400">
                  {grid.filter(c => c?.type === 'cobot' || c?.type === 'conveyor' || c?.type === 'sorter').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">Actieve orders:</span>
                <span className="text-xs font-mono text-green-400">
                  {orders.filter(o => o.status !== 'completed').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">Totale winst:</span>
                <span className="text-xs font-mono text-yellow-400">
                  €{score * 350 + (orders.filter(o => o.status === 'completed').length * 100)}
                </span>
              </div>
              <div className="pt-2 border-t border-neutral-700">
                <div className="text-xs text-neutral-400 mb-1">STRATEGIE:</div>
                <ul className="text-xs text-neutral-300 space-y-1">
                  <li>• Gebruik automatisering voor bulk orders</li>
                  <li>• Handmatig voor speciale orders</li>
                  <li>• Mix rolltainers met kleuren</li>
                  <li>• Sorteer machines besparen tijd</li>
                </ul>
              </div>
            </div>
          </div>

          {/* GAME TIPS */}
          <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-700">
            <h3 className="font-bold text-blue-300 mb-2 text-sm">💡 TIPS</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>• Begin bij het Order Station voor nieuwe orders</li>
              <li>• Gebruik automatische machines voor efficiëntie</li>
              <li>• Zet pallets op de juiste kleur voor elke order</li>
              <li>• Speed 3x als je automatisering hebt staan</li>
              <li>• Verkoop oude machines om upgrades te kopen</li>
            </ul>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-6 text-center text-xs text-neutral-500 max-w-3xl">
        <p>WAREHOUSE MANAGER • Bestuur je karakter met WASD • Neem orders aan • Gebruik automatisering om te schalen • Word de beste warehouse manager!</p>
      </div>
    </div>
  );
}