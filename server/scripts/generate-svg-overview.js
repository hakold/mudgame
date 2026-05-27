/**
 * SVG 总览图生成器
 * 读取 maps.json + rooms.json，按规范生成单文件 SVG
 * 规范参考: SVG生成规范-给其他AI.md
 */
const fs = require('fs');
const path = require('path');

// ====== 读取数据 ======
const maps = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/json/maps.json'), 'utf8'));
const rooms = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/json/rooms.json'), 'utf8'));

// ====== 构建索引 ======
const roomMap = {};       // roomId → room
const mapRoomList = {};   // mapId → [room, ...]
const edges = [];         // {from, to, direction, crossMap}
const roomToMap = {};     // roomId → mapId

for (const r of rooms) {
  roomMap[r.id] = r;
  roomToMap[r.id] = r.mapId;
  if (!mapRoomList[r.mapId]) mapRoomList[r.mapId] = [];
  mapRoomList[r.mapId].push(r);
}

// Build edges from exits
for (const r of rooms) {
  for (const ex of (r.exits || [])) {
    const targetMapId = roomToMap[ex.roomId] || '?';
    edges.push({
      from: r.id,
      to: ex.roomId,
      direction: ex.direction,
      crossMap: targetMapId !== r.mapId
    });
  }
}

// ====== 分析 ======
const mapIds = maps.map(m => m.id);
const isolatedRooms = [];

// Find isolated rooms (no exits, and not targeted by any exit)
const targetedRooms = new Set(edges.map(e => e.to));
const hasExits = new Set(edges.map(e => e.from));
for (const r of rooms) {
  if (!hasExits.has(r.id) && !targetedRooms.has(r.id)) {
    isolatedRooms.push(r);
  }
}

// Count cross-map edges
const crossMapEdges = edges.filter(e => e.crossMap);
const intraMapEdges = edges.filter(e => !e.crossMap);

// ====== 布局参数 ======
const MAP_PADDING = 30;
const MAP_HEADER_H = 40;
const ROOM_W = 180;
const ROOM_H = 52;
const ROOM_GAP_X = 30;
const ROOM_GAP_Y = 40;
const MAP_GAP = 60;

// Grid layout for maps
const MAPS_PER_ROW = 3;
const mapCols = Math.min(maps.length, MAPS_PER_ROW);

// ====== 地图级布局 ======
// Sort: 稻香村 first (lowest level), then by level
const mapOrder = [...maps].sort((a, b) => {
  const aLv = parseInt((a.level || '1-1').split('-')[0]);
  const bLv = parseInt((b.level || '1-1').split('-')[0]);
  if (a.id === 'Daoxiang_village') return -1;
  if (b.id === 'Daoxiang_village') return 1;
  return aLv - bLv;
});

// ====== 房间级布局（每张地图内） ======
function layoutRoomsInMap(mapId) {
  const mapRooms = (mapRoomList[mapId] || []).filter(r => !isolatedRooms.includes(r));
  if (mapRooms.length === 0) return { positions: {}, w: ROOM_W, h: ROOM_H };

  const mapInfo = maps.find(m => m.id === mapId);
  const entryRoomId = mapInfo?.entryRoom;
  const entryRoom = roomMap[entryRoomId];

  // Build adjacency for this map
  const adj = {}; // roomId → [roomId]
  for (const r of mapRooms) adj[r.id] = [];
  for (const e of edges) {
    if (!e.crossMap && adj[e.from] && adj[e.to]) {
      adj[e.from].push(e.to);
    }
  }

  // BFS from entry room for tree layout
  const visited = new Set();
  const layers = []; // [[roomId, ...], ...]

  function bfs(start) {
    if (!start || visited.has(start)) return;
    const queue = [{ id: start, depth: 0 }];
    visited.add(start);
    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (!layers[depth]) layers[depth] = [];
      layers[depth].push(id);
      for (const nb of (adj[id] || [])) {
        if (!visited.has(nb) && roomMap[nb]) {
          visited.add(nb);
          queue.push({ id: nb, depth: depth + 1 });
        }
      }
    }
  }

  // Start BFS from entry room
  if (entryRoom) bfs(entryRoomId);

  // Also try any unvisited rooms (disconnected subgraphs)
  for (const r of mapRooms) {
    if (!visited.has(r.id)) bfs(r.id);
  }

  // If no layers (empty map), add a single layer
  if (layers.length === 0) layers.push(mapRooms.map(r => r.id));

  // Assign positions by layer
  const positions = {};
  const colSpacing = ROOM_W + ROOM_GAP_X;
  const rowSpacing = ROOM_H + ROOM_GAP_Y;
  let maxCols = 1;

  for (let depth = 0; depth < layers.length; depth++) {
    const layer = layers[depth];
    maxCols = Math.max(maxCols, layer.length);
    for (let i = 0; i < layer.length; i++) {
      positions[layer[i]] = {
        x: i * colSpacing + ROOM_GAP_X / 2,
        y: depth * rowSpacing + MAP_HEADER_H + MAP_PADDING
      };
    }
  }

  const w = Math.max(ROOM_W + ROOM_GAP_X, maxCols * colSpacing + ROOM_GAP_X);
  const h = layers.length * rowSpacing + MAP_HEADER_H + MAP_PADDING * 2 + ROOM_H;

  return { positions, w, h, layers, entryRoomId };
}

// ====== 计算所有地图的布局 ======
const mapLayouts = {};
let totalMapW = 0;
let totalMapH = 0;

const mapRowInfo = []; // per-row heights

for (let i = 0; i < mapOrder.length; i++) {
  const map = mapOrder[i];
  const layout = layoutRoomsInMap(map.id);
  mapLayouts[map.id] = layout;
  mapLayouts[map.id]._mapIdx = i;
}

// Arrange maps in a grid
const mapPositions = {};
let maxRowH = 0;
let currentRowX = MAP_GAP;
let currentRowY = MAP_GAP;

for (let i = 0; i < mapOrder.length; i++) {
  const mapId = mapOrder[i].id;
  const col = i % mapCols;
  const layout = mapLayouts[mapId];

  if (col === 0 && i > 0) {
    currentRowX = MAP_GAP;
    currentRowY += maxRowH + MAP_GAP;
    maxRowH = 0;
  }

  mapPositions[mapId] = { x: currentRowX, y: currentRowY, w: layout.w, h: layout.h };
  maxRowH = Math.max(maxRowH, layout.h);
  currentRowX += layout.w + MAP_GAP;
  totalMapW = Math.max(totalMapW, currentRowX);
  totalMapH = currentRowY + maxRowH + MAP_GAP;
}

// ====== 孤立房间区域 ======
const ISOLATED_AREA_Y = totalMapH + MAP_GAP;
const ISOLATED_W = ROOM_W;
const ISOLATED_H = ROOM_H;
const isolatedCols = Math.min(isolatedRooms.length, 6);
let isolatedAreaW = 0;
let isolatedAreaH = ISOLATED_AREA_Y;

if (isolatedRooms.length > 0) {
  isolatedAreaW = isolatedCols * (ROOM_W + ROOM_GAP_X) + ROOM_GAP_X;
  isolatedAreaH += MAP_HEADER_H + Math.ceil(isolatedRooms.length / isolatedCols) * (ROOM_H + ROOM_GAP_Y) + MAP_PADDING * 2;
  totalMapH = isolatedAreaH + MAP_GAP;
}

// ====== SVG 生成 ======
const SVG_W = Math.max(totalMapW + MAP_GAP, isolatedAreaW + MAP_GAP);
const SVG_H = totalMapH + MAP_GAP;

function colorForMap(index) {
  const colors = ['#1a3a2a', '#1a2a3a', '#2a1a3a', '#1a1a3a'];
  return colors[index % colors.length];
}

function svgEscape(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function directionSymbol(dir) {
  const sym = { north: '⬆', south: '⬇', east: '➡', west: '⬅', up: '⬆', down: '⬇',
    enter: '↘', out: '↖', north_east: '↗', north_west: '↖', south_east: '↘', south_west: '↙' };
  return sym[dir] || '→';
}

let svg = '';
svg += `<?xml version="1.0" encoding="UTF-8"?>\n`;
svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}">\n`;
svg += `<defs>
  <marker id="arrow-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#4fc3f7"/></marker>
  <marker id="arrow-orange" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#ff9800"/></marker>
</defs>\n`;
svg += `<rect width="${SVG_W}" height="${SVG_H}" fill="#0a0a1a"/>\n`;
svg += `<text x="30" y="35" font-size="22" font-weight="bold" fill="#e94560" font-family="monospace">侠客行 MUD — 地图总览</text>\n`;
svg += `<text x="30" y="55" font-size="12" fill="#888" font-family="monospace">MAP: ${maps.length} | ROOM: ${rooms.length} | 连线: ${intraMapEdges.length} | 跨地图: ${crossMapEdges.length} | 孤立: ${isolatedRooms.length}</text>\n`;

// ====== 画跨地图连线（先画，Z 序最低） ======
for (const e of crossMapEdges) {
  const fromMapId = roomToMap[e.from];
  const toMapId = roomToMap[e.to];
  const fromLayout = mapLayouts[fromMapId];
  const toLayout = mapLayouts[toMapId];
  if (!fromLayout || !toLayout) continue;

  const fromPos = fromLayout.positions?.[e.from];
  const toPos = toLayout.positions?.[e.to];
  if (!fromPos || !toPos) continue;

  const fm = mapPositions[fromMapId];
  const tm = mapPositions[toMapId];

  const x1 = (fm?.x || 0) + (fromPos.x || 0) + ROOM_W / 2;
  const y1 = (fm?.y || 0) + (fromPos.y || 0) + ROOM_H / 2;
  const x2 = (tm?.x || 0) + (toPos.x || 0) + ROOM_W / 2;
  const y2 = (tm?.y || 0) + (toPos.y || 0) + ROOM_H / 2;

  // Curved line for cross-map
  const midX = (x1 + x2) / 2;
  const midY = Math.min(y1, y2) - 40;
  svg += `<path d="M${x1},${y1} Q${midX},${midY} ${x2},${y2}" fill="none" stroke="#ff9800" stroke-width="1.5" stroke-dasharray="6,3" marker-end="url(#arrow-orange)" opacity="0.7"/>\n`;
}

// ====== 画每张地图 ======
for (const map of mapOrder) {
  const mp = mapPositions[map.id];
  const layout = mapLayouts[map.id];
  if (!mp || !layout) continue;

  const bgColor = colorForMap(mapOrder.indexOf(map));
  const isStart = map.id === 'Daoxiang_village';

  // Map frame
  svg += `<rect x="${mp.x}" y="${mp.y}" width="${mp.w}" height="${mp.h}" rx="8" fill="${bgColor}" stroke="${isStart ? '#ffd700' : '#4fc3f7'}" stroke-width="${isStart ? 3 : 1.5}"/>\n`;
  svg += `<text x="${mp.x + 15}" y="${mp.y + 28}" font-size="15" font-weight="bold" fill="#ffd700" font-family="monospace">${svgEscape(map.name)}</text>\n`;
  svg += `<text x="${mp.x + 15}" y="${mp.y + 44}" font-size="10" fill="#888" font-family="monospace">Lv ${svgEscape(map.level || '?')} | ${(map.rooms || []).length} 房间 | ${layout.entryRoomId ? roomMap[layout.entryRoomId]?.name || layout.entryRoomId : '?'}</text>\n`;

  // Intra-map edges (draw before rooms)
  for (const e of intraMapEdges) {
    if (roomToMap[e.from] !== map.id) continue;
    const fromPos = layout.positions[e.from];
    const toPos = layout.positions[e.to];
    if (!fromPos || !toPos) continue;

    const x1 = mp.x + fromPos.x + ROOM_W / 2;
    const y1 = mp.y + fromPos.y + ROOM_H / 2;
    const x2 = mp.x + toPos.x + ROOM_W / 2;
    const y2 = mp.y + toPos.y + ROOM_H / 2;

    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4fc3f7" stroke-width="1" marker-end="url(#arrow-green)" opacity="0.6"/>\n`;
  }

  // Room nodes
  for (const [roomId, pos] of Object.entries(layout.positions)) {
    const rx = mp.x + pos.x, ry = mp.y + pos.y;
    const isEntry = roomId === layout.entryRoomId;
    const room = roomMap[roomId];
    if (!room) continue;

    const nExitCount = (room.exits || []).length;
    const hasCrossMap = (room.exits || []).some(ex => roomToMap[ex.roomId] !== room.mapId);

    // Room rect
    svg += `<rect x="${rx}" y="${ry}" width="${ROOM_W}" height="${ROOM_H}" rx="4"
      fill="#0f3460" stroke="${isEntry ? '#ffd700' : (hasCrossMap ? '#ff9800' : '#1a4a7a')}"
      stroke-width="${isEntry ? 2.5 : 1}"/>\n`;

    // Room name
    svg += `<text x="${rx + 8}" y="${ry + 18}" font-size="12" fill="#eee" font-family="monospace" font-weight="bold">${svgEscape(room.name)}</text>\n`;
    // Room ID
    svg += `<text x="${rx + 8}" y="${ry + 34}" font-size="9" fill="#888" font-family="monospace">${svgEscape(room.id)}</text>\n`;
    // Exit count badge
    if (nExitCount > 0) {
      svg += `<text x="${rx + ROOM_W - 10}" y="${ry + 34}" font-size="9" fill="#4fc3f7" font-family="monospace" text-anchor="end">${nExitCount}↗</text>\n`;
    }
    // Entry badge
    if (isEntry) {
      svg += `<rect x="${rx + ROOM_W - 36}" y="${ry + 4}" width="30" height="14" rx="3" fill="#ffd700" opacity="0.8"/>\n`;
      svg += `<text x="${rx + ROOM_W - 21}" y="${ry + 15}" font-size="8" fill="#0a0a1a" font-family="monospace" text-anchor="middle">入口</text>\n`;
    }
    // Cross-map badge
    if (hasCrossMap && !isEntry) {
      svg += `<rect x="${rx + ROOM_W - 36}" y="${ry + 4}" width="30" height="14" rx="3" fill="#ff9800" opacity="0.6"/>\n`;
      svg += `<text x="${rx + ROOM_W - 21}" y="${ry + 15}" font-size="7" fill="#fff" font-family="monospace" text-anchor="middle">跨图</text>\n`;
    }
  }
}

// ====== 孤立房间区 ======
if (isolatedRooms.length > 0) {
  const irX = MAP_GAP;
  const irY = ISOLATED_AREA_Y;
  const irW = isolatedAreaW;
  const irH = Math.ceil(isolatedRooms.length / isolatedCols) * (ROOM_H + ROOM_GAP_Y) + MAP_HEADER_H + MAP_PADDING * 2;

  svg += `<rect x="${irX}" y="${irY}" width="${irW}" height="${irH}" rx="8" fill="#1a1a1a" stroke="#666" stroke-width="1.5" stroke-dasharray="5,3"/>\n`;
  svg += `<text x="${irX + 15}" y="${irY + 28}" font-size="14" fill="#999" font-family="monospace">孤立房间 (${isolatedRooms.length})</text>\n`;

  for (let i = 0; i < isolatedRooms.length; i++) {
    const col = i % isolatedCols;
    const row = Math.floor(i / isolatedCols);
    const rx = irX + ROOM_GAP_X + col * (ROOM_W + ROOM_GAP_X);
    const ry = irY + MAP_HEADER_H + row * (ROOM_H + ROOM_GAP_Y);
    const room = isolatedRooms[i];

    svg += `<rect x="${rx}" y="${ry}" width="${ROOM_W}" height="${ROOM_H}" rx="4" fill="#1a1a2a" stroke="#444" stroke-width="1"/>\n`;
    svg += `<text x="${rx + 8}" y="${ry + 18}" font-size="11" fill="#777" font-family="monospace">${svgEscape(room.name)}</text>\n`;
    svg += `<text x="${rx + 8}" y="${ry + 34}" font-size="9" fill="#555" font-family="monospace">${svgEscape(room.id)}</text>\n`;
    svg += `<text x="${rx + ROOM_W - 10}" y="${ry + 34}" font-size="8" fill="#555" font-family="monospace" text-anchor="end">⚡孤立</text>\n`;
  }
}

svg += `</svg>\n`;

// ====== 输出 ======
const outPath = path.join(__dirname, '../../client/public/map-overview.svg');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, svg);
console.log(`✅ SVG 已生成: ${outPath}`);
console.log(`📊 统计: MAP ${maps.length} | ROOM ${rooms.length} | 地图内连线 ${intraMapEdges.length} | 跨地图连线 ${crossMapEdges.length} | 孤立房间 ${isolatedRooms.length}`);
console.log(`📐 SVG 尺寸: ${SVG_W}×${SVG_H}`);
