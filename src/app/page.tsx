"use client";
import React, { useState, useEffect, useCallback } from 'react';

// --- CONFIGURATIE & TYPES ---

const COLORS = ['red', 'blue', 'green', 'purple'];
const MAX_PALLET = 10;
const GRID_SIZE = 8;
const CELL_SIZE = 64; // pixels per grid cell
const PLAYER_SIZE = 32; // player size in pixels
const PLAYER_SPEED = 3;

type StructureType = 'pallet' | 'conveyor' | 'sorter' | 'rolltainer' | 'cobot' | 'orderdesk' | 'truck';
type Direction = 'up' | 'down' | 'left' | 'right';

interface GridCell {
  id: string;
  type: StructureType;
  color?: string;
  count?: number;
  rotation?: number;
  crate?: string | null;
  x: number; // grid x position
  y: number; // grid y position
}

interface Player {
  x: number; // pixel position
  y: number; // pixel position
  angle: number; // rotation in degrees
  carrying: string | null; // color of carried item
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
  { type: 'truck', price: 500, label: 'Laad-dock', icon: '🚛', desc: 'Voor snelle leveringen' },
];

export default function WarehouseGame() {
  // --- STATES ---
  const [grid, setGrid] = useState<GridCell[]>(() => {
    const initial: GridCell[] = [];
    // Order desk in de hoek
    initial.push({ id: 'desk1', type: 'orderdesk', x: 0, y: 0 });
    
    // Een paar rolltainers
    initial.push({ id: 'roll1', type: 'rolltainer', x: 2, y: 2, crate: null });
    initial.push({ id: 'roll2', type: 'rolltainer', x: 5, y: 2, crate: null });
    
    // Een transportband
    initial.push({ id: 'conv1', type: 'conveyor', x: 3, y: 3, rotation: 1 });
    
    return initial;
  });
  
  const [player, setPlayer] = useState<Player>({
    x: CELL_SIZE * 2,
    y: CELL_SIZE * 5,
    angle: 90, // Kijkt naar boven
    carrying: null,
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
  const [showGrid, setShowGrid] = useState(false);
  const [keysPressed, setKeysPressed] = useState<{ [key: string]: boolean }>({});
  const [activeOrder, setActiveOrder] = useState<string | null>('order1');
  const [gameSpeed, setGameSpeed] = useState(1);

  const uid = () => Math.random().toString(36).substr(2, 9);

  // --- COLLISION DETECTION ---
  const checkCollision = (px: number, py: number) => {
    // Bounds collision
    if (px < 0 || px > GRID_SIZE * CELL_SIZE - PLAYER_SIZE / 2 ||
        py < 0 || py > GRID_SIZE * CELL_SIZE - PLAYER_SIZE / 2) {
      return true;
    }
    
    // Grid object collision
    const playerGridX = Math.floor(px / CELL_SIZE);
    const playerGridY = Math.floor(py / CELL_SIZE);
    
    // Check if any grid object occupies this cell
    for (const cell of grid) {
      if (cell.x === playerGridX && cell.y === playerGridY) {
        // Allow walking over conveyors and sorters but not other objects
        if (cell.type === 'conveyor' || cell.type === 'sorter') {
          return false;
        }
        return true;
      }
    }
    
    return false;
  };

  // --- PLAYER MOVEMENT ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['w', 'a', 's', 'd', 'e', 'v'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        setKeysPressed(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['w', 'a', 's', 'd', 'e', 'v'].includes(e.key.toLowerCase())) {
        setKeysPressed(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
      }
      
      // E key for interaction
      if (e.key.toLowerCase() === 'e') {
        handlePlayerInteract();
      }
      
      // V key to toggle grid
      if (e.key.toLowerCase() === 'v') {
        setShowGrid(prev => !prev);
      }
      
      // Escape to cancel shop selection
      if (e.key === 'Escape') {
        setSelectedShopItem(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game loop for player movement
  useEffect(() => {
    const gameLoop = setInterval(() => {
      setPlayer(prev => {
        let newX = prev.x;
        let newY = prev.y;
        let newAngle = prev.angle;
        
        // Rotation
        if (keysPressed['a']) {
          newAngle = (prev.angle - 5) % 360;
        }
        if (keysPressed['d']) {
          newAngle = (prev.angle + 5) % 360;
        }
        
        // Movement
        let moveX = 0;
        let moveY = 0;
        
        if (keysPressed['w']) {
          const rad = newAngle * Math.PI / 180;
          moveX = Math.sin(rad) * PLAYER_SPEED;
          moveY = -Math.cos(rad) * PLAYER_SPEED;
        }
        if (keysPressed['s']) {
          const rad = newAngle * Math.PI / 180;
          moveX = -Math.sin(rad) * PLAYER_SPEED;
          moveY = Math.cos(rad) * PLAYER_SPEED;
        }
        
        // Check collision for new position
        const potentialX = prev.x + moveX;
        const potentialY = prev.y + moveY;
        
        if (!checkCollision(potentialX, potentialY)) {
          newX = potentialX;
          newY = potentialY;
        } else {
          // Try moving only in X or Y direction
          if (!checkCollision(potentialX, prev.y)) {
            newX = potentialX;
          }
          if (!checkCollision(prev.x, potentialY)) {
            newY = potentialY;
          }
        }
        
        return { ...prev, x: newX, y: newY, angle: newAngle };
      });
    }, 16); // ~60 FPS
    
    return () => clearInterval(gameLoop);
  }, [keysPressed]);

  // --- PLAYER INTERACTION ---
  const handlePlayerInteract = () => {
    const playerGridX = Math.floor(player.x / CELL_SIZE);
    const playerGridY = Math.floor(player.y / CELL_SIZE);
    
    // Find cell at player's position
    const cell = grid.find(c => c.x === playerGridX && c.y === playerGridY);
    
    if (!cell) return;
    
    // Orderdesk - accept new order
    if (cell.type === 'orderdesk') {
      generateNewOrder();
      return;
    }
    
    // Rolltainer - pick up crate
    if (cell.type === 'rolltainer' && cell.crate && !player.carrying) {
      setPlayer(prev => ({ ...prev, carrying: cell.crate ?? null }));
      setGrid(prev => prev.map(c => 
        c.id === cell.id ? { ...c, crate: null } : c
      ));
      return;
    }
    
    // Pallet - place crate for order
    if (cell.type === 'pallet' && player.carrying && activeOrder) {
      const order = orders.find(o => o.id === activeOrder);
      if (order && cell.color === player.carrying) {
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
          setGrid(prev => prev.map(c => 
            c.id === cell.id ? { ...c, count: (c.count || 0) + 1 } : c
          ));
          
          setPlayer(prev => ({ ...prev, carrying: null }));
          checkOrderComplete(activeOrder, updatedOrders);
        }
      }
      return;
    }
    
    // Truck - deliver order
    if (cell.type === 'truck' && activeOrder) {
      const order = orders.find(o => o.id === activeOrder);
      if (order && order.status === 'delivering') {
        deliverOrder(order.id);
      }
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
    }
  };

  const deliverOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, status: 'completed' } : o
    ));
    
    setMoney(m => m + 100); // Delivery bonus
    setActiveOrder(null);
  };

  // --- AUTOMATISERING SYSTEMS ---
  useEffect(() => {
    const interval = setInterval(() => {
      setGrid((currentGrid) => {
        const nextGrid = [...currentGrid];
        let changed = false;

        // Rolltainers generate packages
        for (const cell of nextGrid) {
          if (cell.type === 'rolltainer' && !cell.crate) {
            if (Math.random() > 0.7) {
              cell.crate = COLORS[Math.floor(Math.random() * COLORS.length)];
              changed = true;
            }
          }
        }

        // Cobot automation
        for (const cobot of nextGrid.filter(c => c.type === 'cobot')) {
          const isVertical = cobot.rotation === 0 || cobot.rotation === 2;
          const directions = isVertical ? [
            { x: cobot.x, y: cobot.y - 1 }, // up
            { x: cobot.x, y: cobot.y + 1 }  // down
          ] : [
            { x: cobot.x - 1, y: cobot.y }, // left
            { x: cobot.x + 1, y: cobot.y }  // right
          ];
          
          let sourceCell: GridCell | null = null;
          let targetCell: GridCell | null = null;
          
          for (const dir of directions) {
            const neighbor = nextGrid.find(c => c.x === dir.x && c.y === dir.y);
            if (neighbor?.type === 'rolltainer' && neighbor.crate) {
              sourceCell = neighbor;
            } else if (neighbor?.type === 'conveyor' && !neighbor.crate) {
              targetCell = neighbor;
            }
          }
          
          if (sourceCell && targetCell) {
            targetCell.crate = sourceCell.crate;
            sourceCell.crate = null;
            changed = true;
          }
        }

        // Conveyor and sorter movement
        for (const cell of nextGrid) {
          if ((cell.type === 'conveyor' || cell.type === 'sorter') && cell.crate) {
            let targetX = cell.x;
            let targetY = cell.y;
            
            if (cell.type === 'conveyor') {
              switch (cell.rotation) {
                case 0: targetY--; break; // up
                case 1: targetX++; break; // right
                case 2: targetY++; break; // down
                case 3: targetX--; break; // left
              }
            } else if (cell.type === 'sorter') {
              if (cell.crate === cell.color) {
                // Go to correct output
                switch (cell.rotation) {
                  case 0: targetY--; break;
                  case 1: targetX++; break;
                  case 2: targetY++; break;
                  case 3: targetX--; break;
                }
              } else {
                // Go to reject output
                switch (cell.rotation) {
                  case 0: targetX++; break;
                  case 1: targetY++; break;
                  case 2: targetX--; break;
                  case 3: targetY--; break;
                }
              }
            }
            
            const targetCell = nextGrid.find(c => c.x === targetX && c.y === targetY);
            
            if (targetCell) {
              if (targetCell.type === 'pallet' && targetCell.color === cell.crate && (targetCell.count || 0) < MAX_PALLET) {
                targetCell.count = (targetCell.count || 0) + 1;
                cell.crate = null;
                changed = true;
              } else if ((targetCell.type === 'conveyor' || targetCell.type === 'sorter') && !targetCell.crate) {
                targetCell.crate = cell.crate;
                cell.crate = null;
                changed = true;
              }
            }
          }
        }
        
        return changed ? nextGrid : currentGrid;
      });
    }, 800 / gameSpeed);
    
    return () => clearInterval(interval);
  }, [gameSpeed]);

  // --- GRID PLACEMENT ---
  const handleGridClick = (gridX: number, gridY: number) => {
    // Check if player can reach this cell (adjacent)
    const playerGridX = Math.floor(player.x / CELL_SIZE);
    const playerGridY = Math.floor(player.y / CELL_SIZE);
    const distance = Math.abs(playerGridX - gridX) + Math.abs(playerGridY - gridY);
    
    if (distance > 2) {
      alert('Te ver weg! Loop dichterbij.');
      return;
    }
    
    const existingCell = grid.find(c => c.x === gridX && c.y === gridY);
    
    if (selectedShopItem) {
      if (!existingCell) {
        const item = SHOP_ITEMS.find(i => i.type === selectedShopItem);
        if (item && money >= item.price) {
          const newCell: GridCell = {
            id: uid(),
            type: selectedShopItem,
            x: gridX,
            y: gridY,
            rotation: (selectedShopItem === 'cobot') ? 0 : 1,
            color: (selectedShopItem === 'pallet' || selectedShopItem === 'sorter') ? COLORS[0] : undefined,
            count: 0,
            crate: null
          };
          setGrid(prev => [...prev, newCell]);
          setMoney(m => m - item.price);
          setSelectedShopItem(null);
        }
      }
      return;
    }
    
    if (existingCell) {
      // Rotate conveyor/sorter/cobot
      if (existingCell.type === 'cobot' || existingCell.type === 'conveyor' || existingCell.type === 'sorter') {
        setGrid(prev => prev.map(c => 
          c.id === existingCell.id 
            ? { ...c, rotation: ((c.rotation || 0) + 1) % 4 } 
            : c
        ));
      }
    }
  };

  const cycleColor = (cellId: string) => {
    const cell = grid.find(c => c.id === cellId);
    if (cell && (cell.type === 'sorter' || cell.type === 'pallet')) {
      const currentColorIdx = COLORS.indexOf(cell.color || COLORS[0]);
      const newColor = COLORS[(currentColorIdx + 1) % COLORS.length];
      setGrid(prev => prev.map(c => 
        c.id === cellId ? { ...c, color: newColor } : c
      ));
    }
  };

  // --- VISUAL HELPERS ---
  const getBgColor = (c?: string) => {
    if (c === 'red') return 'bg-red-500';
    if (c === 'blue') return 'bg-blue-500';
    if (c === 'green') return 'bg-green-500';
    if (c === 'purple') return 'bg-purple-500';
    return 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-gray-900 text-white font-sans p-4 flex flex-col items-center select-none">
      {/* HEADER */}
      <div className="w-full max-w-7xl flex justify-between items-center bg-neutral-800 p-4 rounded-xl border-2 border-neutral-700 mb-4 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-orange-500">WAREHOUSE SIMULATOR PRO</h1>
          <p className="text-sm text-neutral-400">Pixel-based movement • Automatisering • Order Management</p>
        </div>
        <div className="flex gap-6 items-center">
          <div className="text-right">
            <span className="block text-xs text-neutral-400">GELD</span>
            <span className="text-3xl font-mono text-green-400">€{money}</span>
          </div>
          <div className="text-right">
            <span className="block text-xs text-neutral-400">SCORE</span>
            <span className="text-3xl font-mono text-blue-400">{score}</span>
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
        
        {/* LINKERKANT - CONTROLS & ORDERS */}
        <div className="flex flex-col gap-4 w-full lg:w-80">
          {/* PLAYER CONTROLS */}
          <div className="bg-neutral-800 p-4 rounded-xl border-2 border-neutral-700 shadow-lg">
            <h2 className="font-bold text-neutral-300 mb-3 text-lg">👤 BESTURING</h2>
            
            <div className="flex items-center gap-4 mb-4 p-3 bg-neutral-900 rounded-lg">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-xl">
                  <div 
                    className="w-4 h-4 bg-white rounded-full"
                    style={{
                      transform: `translate(${Math.sin(player.angle * Math.PI / 180) * 20}px, ${-Math.cos(player.angle * Math.PI / 180) * 20}px)`
                    }}
                  />
                </div>
                {player.carrying && (
                  <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white ${getBgColor(player.carrying)}`}></div>
                )}
              </div>
              <div>
                <div className="text-sm">Positie: ({Math.floor(player.x / CELL_SIZE)}, {Math.floor(player.y / CELL_SIZE)})</div>
                <div className={`text-xs ${player.carrying ? 'text-green-400' : 'text-neutral-400'}`}>
                  {player.carrying ? `Draagt: ${player.carrying}` : 'Geen item'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="col-start-2">
                <div className="text-center text-xs text-neutral-400 mb-1">W</div>
                <div className="w-12 h-12 bg-neutral-700 rounded-lg flex items-center justify-center mx-auto">
                  <div className="transform -rotate-90">↑</div>
                </div>
              </div>
              <div>
                <div className="text-center text-xs text-neutral-400 mb-1">A</div>
                <div className="w-12 h-12 bg-neutral-700 rounded-lg flex items-center justify-center mx-auto">
                  ←
                </div>
              </div>
              <div>
                <div className="text-center text-xs text-neutral-400 mb-1">S</div>
                <div className="w-12 h-12 bg-neutral-700 rounded-lg flex items-center justify-center mx-auto">
                  ↓
                </div>
              </div>
              <div>
                <div className="text-center text-xs text-neutral-400 mb-1">D</div>
                <div className="w-12 h-12 bg-neutral-700 rounded-lg flex items-center justify-center mx-auto">
                  →
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handlePlayerInteract}
                className="p-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <span className="text-xl">E</span>
                <span className="text-sm">Interact</span>
              </button>
              <button 
                onClick={() => setShowGrid(!showGrid)}
                className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <span className="text-xl">V</span>
                <span className="text-sm">{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
              </button>
            </div>
          </div>

          {/* ACTIVE ORDERS */}
          <div className="bg-neutral-800 p-4 rounded-xl border-2 border-neutral-700 shadow-lg flex-1">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-neutral-300 text-lg">📋 ORDERS</h2>
              <button
                onClick={generateNewOrder}
                className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1 rounded transition-colors"
              >
                + Nieuw
              </button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {orders.filter(o => o.status !== 'completed').map((order) => (
                <div
                  key={order.id}
                  className={`p-3 rounded-lg border-2 ${order.id === activeOrder ? 'border-orange-500 bg-neutral-700' : 'border-neutral-600 bg-neutral-800/50'}`}
                  onClick={() => setActiveOrder(order.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-sm">{order.address}</div>
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
                  
                  <div className="space-y-1 mb-2">
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
                      className="w-full mt-2 bg-green-600 hover:bg-green-700 py-2 rounded text-sm transition-colors font-bold"
                    >
                      🚚 Lever Af (+€100)
                    </button>
                  )}
                </div>
              ))}
              
              {orders.filter(o => o.status !== 'completed').length === 0 && (
                <div className="text-center text-neutral-500 py-6">
                  <div className="text-3xl mb-2">📋</div>
                  <div>Geen actieve orders</div>
                  <div className="text-xs mt-2">Ga naar het Order Station of klik + Nieuw</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTRUM - GAME WORLD */}
        <div className="flex-1">
          <div className="relative" style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}>
            {/* GRID BACKGROUND (optional) */}
            {showGrid && (
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-0 pointer-events-none">
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                  const x = i % GRID_SIZE;
                  const y = Math.floor(i / GRID_SIZE);
                  return (
                    <div
                      key={i}
                      className="border border-neutral-700/50"
                      onClick={() => handleGridClick(x, y)}
                    />
                  );
                })}
              </div>
            )}
            
            {/* GRID OBJECTS */}
            {grid.map((cell) => (
              <div
                key={cell.id}
                className="absolute transition-all duration-200 hover:scale-105 cursor-pointer"
                style={{
                  left: cell.x * CELL_SIZE + 8,
                  top: cell.y * CELL_SIZE + 8,
                  width: CELL_SIZE - 16,
                  height: CELL_SIZE - 16,
                }}
                onClick={() => {
                  if (selectedShopItem) {
                    handleGridClick(cell.x, cell.y);
                  } else if (cell.type === 'sorter' || cell.type === 'pallet') {
                    cycleColor(cell.id);
                  } else if (cell.type === 'conveyor' || cell.type === 'cobot') {
                    // Rotate on click
                    setGrid(prev => prev.map(c => 
                      c.id === cell.id 
                        ? { ...c, rotation: ((c.rotation || 0) + 1) % 4 } 
                        : c
                    ));
                  }
                }}
              >
                {/* ROLLTAINER */}
                {cell.type === 'rolltainer' && (
                  <div className="w-full h-full border-2 border-dashed border-zinc-400 rounded-xl bg-zinc-800/90 flex items-center justify-center relative shadow-lg">
                    <span className="absolute -top-2 -left-2 text-[10px] bg-zinc-600 px-2 py-1 rounded text-white">IN</span>
                    {cell.crate ? (
                      <div className={`w-10 h-10 rounded-lg border-2 border-white/50 shadow-xl ${getBgColor(cell.crate)} flex items-center justify-center`}>
                        <span className="text-sm">📦</span>
                      </div>
                    ) : (
                      <span className="text-sm animate-pulse">...</span>
                    )}
                  </div>
                )}
                
                {/* ORDERDESK */}
                {cell.type === 'orderdesk' && (
                  <div className="w-full h-full border-2 border-dashed border-blue-400 rounded-xl bg-blue-900/40 flex flex-col items-center justify-center relative shadow-lg">
                    <span className="text-3xl mb-1">📋</span>
                    <span className="text-[10px] text-blue-300 font-bold">ORDER</span>
                  </div>
                )}
                
                {/* TRUCK */}
                {cell.type === 'truck' && (
                  <div className="w-full h-full border-2 border-dashed border-green-400 rounded-xl bg-green-900/40 flex flex-col items-center justify-center relative shadow-lg">
                    <span className="text-3xl mb-1">🚛</span>
                    <span className="text-[10px] text-green-300 font-bold">LEVERING</span>
                  </div>
                )}
                
                {/* COBOT */}
                {cell.type === 'cobot' && (
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    style={{ transform: `rotate(${cell.rotation || 0 * 90}deg)` }}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-300 border-4 border-slate-500 flex items-center justify-center shadow-xl">
                      <span className="text-lg">🦾</span>
                    </div>
                  </div>
                )}
                
                {/* CONVEYOR */}
                {cell.type === 'conveyor' && (
                  <div 
                    className="w-full h-full flex items-center justify-center bg-gradient-to-r from-neutral-600 to-neutral-700 rounded-lg shadow-inner"
                    style={{ transform: `rotate(${cell.rotation || 0 * 90}deg)` }}
                  >
                    <div className="w-full h-4 bg-gradient-to-r from-neutral-400 to-neutral-300 animate-pulse rounded"></div>
                  </div>
                )}
                
                {/* SORTER */}
                {cell.type === 'sorter' && (
                  <div 
                    className="w-full h-full relative border-2 border-double border-neutral-400 rounded-lg shadow-lg"
                    style={{ transform: `rotate(${cell.rotation || 0 * 90}deg)` }}
                  >
                    <div 
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer z-30 ${getBgColor(cell.color)}`}
                    ></div>
                    <div className="absolute inset-2 border border-neutral-500 opacity-20 rounded-sm"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 text-xl">⬆</div>
                  </div>
                )}
                
                {/* PALLET */}
                {cell.type === 'pallet' && (
                  <div className="w-full h-full flex flex-col justify-between bg-gradient-to-b from-amber-900/80 to-amber-950/80 rounded-lg p-2 shadow-lg">
                    <div className="flex justify-between items-start relative h-full">
                      <div 
                        className={`w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer z-30 ${getBgColor(cell.color)}`}
                      ></div>
                      <span className={`text-xs font-mono ${cell.count! >= MAX_PALLET ? 'text-green-400 animate-pulse' : 'text-neutral-300'}`}>
                        {cell.count || 0}/{MAX_PALLET}
                      </span>
                    </div>
                    <div className="h-2 bg-amber-700 w-full rounded-sm mt-auto"></div>
                  </div>
                )}
                
                {/* CRATE ON OBJECT */}
                {cell.crate && cell.type !== 'rolltainer' && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className={`w-8 h-8 rounded-lg shadow-xl border-2 border-white/50 animate-bounce ${getBgColor(cell.crate)}`}></div>
                  </div>
                )}
              </div>
            ))}
            
            {/* PLAYER */}
            <div
              className="absolute z-50 transition-all duration-100"
              style={{
                left: player.x,
                top: player.y,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE,
                transform: `translate(-50%, -50%) rotate(${player.angle}deg)`,
              }}
            >
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center relative">
                <div className="w-4 h-8 bg-white rounded-t-full absolute top-0"></div>
                {player.carrying && (
                  <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white shadow-xl ${getBgColor(player.carrying)}`}></div>
                )}
              </div>
            </div>
            
            {/* GRID COORDINATES */}
            {showGrid && (
              <div className="absolute bottom-2 right-2 text-xs text-neutral-500 bg-black/50 px-2 py-1 rounded">
                Grid: {showGrid ? 'ON' : 'OFF'}
              </div>
            )}
          </div>
          
          {/* GAME INFO */}
          <div className="mt-4 text-center text-sm text-neutral-400">
            {selectedShopItem ? (
              <div className="animate-pulse text-orange-400">
                Klik op een lege grid cel om {selectedShopItem} te plaatsen (V toont grid)
              </div>
            ) : (
              <div>
                WASD bewegen • E interacteren • V toont/verbergt grid • Klik op machines om te draaien
              </div>
            )}
          </div>
        </div>

        {/* RECHTERKANT - SHOP */}
        <div className="flex flex-col gap-4 w-full lg:w-80">
          {/* SHOP */}
          <div className="bg-neutral-800 p-4 rounded-xl border-2 border-neutral-700 shadow-lg">
            <h2 className="font-bold text-neutral-300 mb-3 text-lg">🏬 AUTOMATISERING</h2>
            <div className="space-y-3">
              {SHOP_ITEMS.map((item) => (
                <button
                  key={item.type}
                  onClick={() => setSelectedShopItem(item.type)}
                  className={`flex flex-col p-3 rounded-xl border-2 transition-all text-left w-full
                    ${selectedShopItem === item.type ? 'border-orange-500 bg-neutral-700 shadow-inner' : 'border-neutral-600 bg-neutral-800 hover:bg-neutral-700'}
                    ${money < item.price ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  disabled={money < item.price}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <div className="font-bold text-sm">{item.label}</div>
                        <div className="text-[10px] text-neutral-400">{item.desc}</div>
                      </div>
                    </div>
                    <span className="text-green-400 font-mono font-bold">€{item.price}</span>
                  </div>
                </button>
              ))}
              
              <div className="mt-4 pt-4 border-t-2 border-neutral-600">
                <div className="text-xs text-neutral-400 mb-2 text-center">
                  Druk V om grid te tonen voor plaatsing
                </div>
                <button
                  onClick={() => setSelectedShopItem(null)}
                  className="w-full p-3 bg-neutral-700 hover:bg-neutral-600 rounded-lg font-bold text-sm transition-colors"
                >
                  ❌ Cancel Selectie
                </button>
              </div>
            </div>
          </div>

          {/* STATISTICS */}
          <div className="bg-neutral-800 p-4 rounded-xl border-2 border-neutral-700 shadow-lg">
            <h3 className="font-bold text-neutral-300 mb-3 text-lg">📊 STATISTIEKEN</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-400">Automatische machines:</span>
                <span className="text-sm font-mono text-blue-400">
                  {grid.filter(c => c.type === 'cobot' || c.type === 'conveyor' || c.type === 'sorter').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-400">Actieve orders:</span>
                <span className="text-sm font-mono text-green-400">
                  {orders.filter(o => o.status !== 'completed').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-400">Verzamelde items:</span>
                <span className="text-sm font-mono text-yellow-400">
                  {grid.filter(c => c.type === 'pallet').reduce((sum, p) => sum + (p.count || 0), 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-400">Totale omzet:</span>
                <span className="text-sm font-mono text-green-400">
                  €{score * 350}
                </span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t-2 border-neutral-600">
              <h4 className="font-bold text-neutral-300 mb-2 text-sm">🎯 TIPS</h4>
              <ul className="text-xs text-neutral-300 space-y-1">
                <li>• Gebruik automatisering voor grote orders</li>
                <li>• Zet pallets bij sorteer machines</li>
                <li>• Cobots werken tussen rolltainers en banden</li>
                <li>• Trucks geven bonus bij levering</li>
                <li>• Snelheid 3x als automatisering staat</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-6 text-center text-xs text-neutral-500 max-w-3xl">
        <p>WAREHOUSE SIMULATOR PRO • Pixel-based movement • Automatisering • Order Management • Schaal je warehouse naar de volgende level!</p>
      </div>
    </div>
  );
}