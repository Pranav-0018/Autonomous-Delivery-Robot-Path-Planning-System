import { useState, useCallback, useRef } from "react";

const GRID_ROWS = 20;
const GRID_COLS = 32;

type CellType = "empty" | "obstacle" | "start" | "end" | "path" | "visited" | "robot";
type Tool = "obstacle" | "start" | "end" | "erase";
type Algorithm = "astar" | "dijkstra" | "bfs" | "dfs";

interface Cell {
  type: CellType;
  g: number;
  h: number;
  f: number;
  parent: [number, number] | null;
}

interface Stats {
  nodesVisited: number;
  pathLength: number;
  timeMs: number;
  status: "idle" | "running" | "found" | "no-path";
}

function heuristic(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function createGrid(): Cell[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      type: "empty" as CellType,
      g: Infinity,
      h: 0,
      f: Infinity,
      parent: null,
    }))
  );
}

const ALGO_INFO: Record<Algorithm, { name: string; short: string; desc: string; accent: string; badge: string; dot: string }> = {
  astar:    { name: "A* Search",     short: "A*",  desc: "Optimal & informed — uses heuristic to guide search toward goal", accent: "cyan",   badge: "bg-cyan-500/15 border-cyan-500/40 text-cyan-300",   dot: "bg-cyan-400" },
  dijkstra: { name: "Dijkstra's",    short: "DIJ", desc: "Optimal & uninformed — explores all directions equally",          accent: "violet", badge: "bg-violet-500/15 border-violet-500/40 text-violet-300", dot: "bg-violet-400" },
  bfs:      { name: "Breadth-First", short: "BFS", desc: "Optimal for unweighted — explores layer by layer",               accent: "emerald",badge: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",dot: "bg-emerald-400" },
  dfs:      { name: "Depth-First",   short: "DFS", desc: "Not optimal — explores deep paths first, fast but suboptimal",   accent: "amber",  badge: "bg-amber-500/15 border-amber-500/40 text-amber-300",  dot: "bg-amber-400" },
};

const TOOLS = [
  { id: "obstacle" as Tool, label: "Obstacle", icon: "⬛", kbd: "1" },
  { id: "start"    as Tool, label: "Start",    icon: "🟢", kbd: "2" },
  { id: "end"      as Tool, label: "End",      icon: "🔴", kbd: "3" },
  { id: "erase"    as Tool, label: "Erase",    icon: "✕",  kbd: "4" },
];

export default function PathPlanningSimulator() {
  const [grid, setGrid] = useState<Cell[][]>(() => {
    const g = createGrid();
    g[10][2].type = "start";
    g[10][29].type = "end";
    for (let r = 3; r < 17; r++) if (r !== 10) g[r][8].type = "obstacle";
    for (let r = 5; r < 18; r++) if (r !== 12) g[r][16].type = "obstacle";
    for (let r = 2; r < 14; r++) if (r !== 7)  g[r][23].type = "obstacle";
    return g;
  });

  const [tool, setTool]           = useState<Tool>("obstacle");
  const [algorithm, setAlgorithm] = useState<Algorithm>("astar");
  const [stats, setStats]         = useState<Stats>({ nodesVisited: 0, pathLength: 0, timeMs: 0, status: "idle" });
  const [isRunning, setIsRunning] = useState(false);
  const [robotPos, setRobotPos]   = useState<[number, number] | null>(null);
  const [speed, setSpeed]         = useState(50);
  const isMouseDown  = useRef(false);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef    = useRef(false);

  const getStart = useCallback((): [number, number] | null => {
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < GRID_COLS; c++)
        if (grid[r][c].type === "start") return [r, c];
    return null;
  }, [grid]);

  const getEnd = useCallback((): [number, number] | null => {
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < GRID_COLS; c++)
        if (grid[r][c].type === "end") return [r, c];
    return null;
  }, [grid]);

  const clearPath = useCallback((g: Cell[][]): Cell[][] => {
    return g.map(row =>
      row.map(cell => ({
        ...cell,
        type: (cell.type === "path" || cell.type === "visited" || cell.type === "robot") ? "empty" : cell.type,
        g: Infinity, h: 0, f: Infinity, parent: null,
      }))
    );
  }, []);

  const handleCellInteract = useCallback((r: number, c: number) => {
    if (isRunning) return;
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      const cell = next[r][c];
      if (tool === "start") {
        for (let i = 0; i < GRID_ROWS; i++)
          for (let j = 0; j < GRID_COLS; j++)
            if (next[i][j].type === "start") next[i][j].type = "empty";
        cell.type = "start";
      } else if (tool === "end") {
        for (let i = 0; i < GRID_ROWS; i++)
          for (let j = 0; j < GRID_COLS; j++)
            if (next[i][j].type === "end") next[i][j].type = "empty";
        cell.type = "end";
      } else if (tool === "obstacle") {
        if (cell.type === "empty" || cell.type === "visited" || cell.type === "path") cell.type = "obstacle";
      } else if (tool === "erase") {
        if (cell.type !== "start" && cell.type !== "end") cell.type = "empty";
      }
      return next;
    });
    setStats(s => ({ ...s, status: "idle" }));
    setRobotPos(null);
  }, [tool, isRunning]);

  const runAlgorithm = useCallback(async () => {
    if (isRunning) return;
    cancelRef.current = false;
    setIsRunning(true);
    setRobotPos(null);

    const startPos = getStart();
    const endPos   = getEnd();
    if (!startPos || !endPos) { setIsRunning(false); return; }

    setGrid(prev => clearPath(prev));
    await new Promise(r => setTimeout(r, 50));
    setStats({ nodesVisited: 0, pathLength: 0, timeMs: 0, status: "running" });
    const t0 = performance.now();

    const workGrid = grid.map(row => row.map(cell => ({
      ...cell,
      type: (cell.type === "path" || cell.type === "visited") ? "empty" as CellType : cell.type,
      g: Infinity, h: 0, f: Infinity, parent: null as [number, number] | null,
    })));

    const [sr, sc] = startPos;
    const [er, ec] = endPos;
    const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
    let visitedCount = 0;
    let found = false;
    const visitOrder: [number, number][] = [];

    if (algorithm === "astar") {
      const open: [number, number][] = [[sr, sc]];
      workGrid[sr][sc].g = 0;
      workGrid[sr][sc].h = heuristic([sr, sc], [er, ec]);
      workGrid[sr][sc].f = workGrid[sr][sc].h;
      const closed = new Set<string>();
      while (open.length > 0) {
        if (cancelRef.current) break;
        open.sort((a, b) => workGrid[a[0]][a[1]].f - workGrid[b[0]][b[1]].f);
        const [r, c] = open.shift()!;
        const key = `${r},${c}`;
        if (closed.has(key)) continue;
        closed.add(key);
        if (workGrid[r][c].type !== "start" && workGrid[r][c].type !== "end") {
          workGrid[r][c].type = "visited";
          visitOrder.push([r, c]);
          visitedCount++;
        }
        if (r === er && c === ec) { found = true; break; }
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
          if (workGrid[nr][nc].type === "obstacle" || closed.has(`${nr},${nc}`)) continue;
          const ng = workGrid[r][c].g + 1;
          if (ng < workGrid[nr][nc].g) {
            workGrid[nr][nc].g = ng;
            workGrid[nr][nc].h = heuristic([nr, nc], [er, ec]);
            workGrid[nr][nc].f = ng + workGrid[nr][nc].h;
            workGrid[nr][nc].parent = [r, c];
            open.push([nr, nc]);
          }
        }
      }
    } else if (algorithm === "dijkstra") {
      const dist: number[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(Infinity));
      dist[sr][sc] = 0;
      workGrid[sr][sc].g = 0;
      const pq: [number, number, number][] = [[0, sr, sc]];
      const visited = new Set<string>();
      while (pq.length > 0) {
        if (cancelRef.current) break;
        pq.sort((a, b) => a[0] - b[0]);
        const [d, r, c] = pq.shift()!;
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (workGrid[r][c].type !== "start" && workGrid[r][c].type !== "end") {
          workGrid[r][c].type = "visited";
          visitOrder.push([r, c]);
          visitedCount++;
        }
        if (r === er && c === ec) { found = true; break; }
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
          if (workGrid[nr][nc].type === "obstacle" || visited.has(`${nr},${nc}`)) continue;
          const nd = d + 1;
          if (nd < dist[nr][nc]) {
            dist[nr][nc] = nd;
            workGrid[nr][nc].g = nd;
            workGrid[nr][nc].parent = [r, c];
            pq.push([nd, nr, nc]);
          }
        }
      }
    } else if (algorithm === "bfs") {
      const queue: [number, number][] = [[sr, sc]];
      const visited = new Set<string>([`${sr},${sc}`]);
      while (queue.length > 0) {
        if (cancelRef.current) break;
        const [r, c] = queue.shift()!;
        if (workGrid[r][c].type !== "start" && workGrid[r][c].type !== "end") {
          workGrid[r][c].type = "visited";
          visitOrder.push([r, c]);
          visitedCount++;
        }
        if (r === er && c === ec) { found = true; break; }
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
          if (workGrid[nr][nc].type === "obstacle" || visited.has(`${nr},${nc}`)) continue;
          visited.add(`${nr},${nc}`);
          workGrid[nr][nc].parent = [r, c];
          queue.push([nr, nc]);
        }
      }
    } else if (algorithm === "dfs") {
      const stack: [number, number][] = [[sr, sc]];
      const visited = new Set<string>();
      while (stack.length > 0) {
        if (cancelRef.current) break;
        const [r, c] = stack.pop()!;
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (workGrid[r][c].type !== "start" && workGrid[r][c].type !== "end") {
          workGrid[r][c].type = "visited";
          visitOrder.push([r, c]);
          visitedCount++;
        }
        if (r === er && c === ec) { found = true; break; }
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
          if (workGrid[nr][nc].type === "obstacle" || visited.has(`${nr},${nc}`)) continue;
          workGrid[nr][nc].parent = [r, c];
          stack.push([nr, nc]);
        }
      }
    }

    const path: [number, number][] = [];
    if (found) {
      let cur: [number, number] | null = [er, ec];
      while (cur !== null) {
        path.unshift(cur);
        const pr: number = cur[0], pc: number = cur[1];
        cur = workGrid[pr][pc].parent;
      }
    }

    const t1 = performance.now();
    const delay = Math.max(1, Math.floor(80 / speed));

    for (let i = 0; i < visitOrder.length; i++) {
      if (cancelRef.current) break;
      const [r, c] = visitOrder[i];
      await new Promise(res => { animationRef.current = setTimeout(res, delay); });
      setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })));
        if (next[r][c].type === "empty") next[r][c].type = "visited";
        return next;
      });
      if (i % 5 === 0) setStats(s => ({ ...s, nodesVisited: i + 1 }));
    }

    if (cancelRef.current) { setIsRunning(false); return; }

    if (found) {
      for (let i = 1; i < path.length - 1; i++) {
        if (cancelRef.current) break;
        const [r, c] = path[i];
        await new Promise(res => { animationRef.current = setTimeout(res, 18); });
        setGrid(prev => {
          const next = prev.map(row => row.map(cell => ({ ...cell })));
          next[r][c].type = "path";
          return next;
        });
      }
    }

    if (cancelRef.current) { setIsRunning(false); return; }

    setStats({
      nodesVisited: visitedCount,
      pathLength: found ? path.length - 1 : 0,
      timeMs: Math.round(t1 - t0),
      status: found ? "found" : "no-path",
    });

    if (found && path.length > 1) {
      for (let i = 0; i < path.length; i++) {
        if (cancelRef.current) break;
        await new Promise(res => { animationRef.current = setTimeout(res, Math.max(25, 110 - speed)); });
        setRobotPos(path[i]);
      }
    }

    setIsRunning(false);
  }, [grid, algorithm, speed, isRunning, getStart, getEnd, clearPath]);

  const handleReset = useCallback(() => {
    cancelRef.current = true;
    if (animationRef.current) clearTimeout(animationRef.current);
    setIsRunning(false);
    setRobotPos(null);
    setGrid(prev => clearPath(prev));
    setStats({ nodesVisited: 0, pathLength: 0, timeMs: 0, status: "idle" });
  }, [clearPath]);

  const handleClearAll = useCallback(() => {
    cancelRef.current = true;
    if (animationRef.current) clearTimeout(animationRef.current);
    setIsRunning(false);
    setRobotPos(null);
    const g = createGrid();
    g[10][2].type = "start";
    g[10][29].type = "end";
    setGrid(g);
    setStats({ nodesVisited: 0, pathLength: 0, timeMs: 0, status: "idle" });
  }, []);

  const handleRandomObstacles = useCallback(() => {
    if (isRunning) return;
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({
        ...cell,
        type: (cell.type === "obstacle" || cell.type === "visited" || cell.type === "path") ? "empty" as CellType : cell.type,
        g: Infinity, h: 0, f: Infinity, parent: null,
      })));
      for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
          if (next[r][c].type === "empty" && Math.random() < 0.22)
            next[r][c].type = "obstacle";
      return next;
    });
    setRobotPos(null);
    setStats({ nodesVisited: 0, pathLength: 0, timeMs: 0, status: "idle" });
  }, [isRunning]);

  const getCellStyle = (cell: Cell, r: number, c: number): string => {
    const isRobot = robotPos && robotPos[0] === r && robotPos[1] === c;
    if (isRobot) return "bg-yellow-300 shadow-[0_0_6px_2px_rgba(253,224,71,0.5)] z-10 scale-110";
    switch (cell.type) {
      case "start":    return "bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.4)]";
      case "end":      return "bg-rose-500 shadow-[0_0_6px_2px_rgba(244,63,94,0.4)]";
      case "obstacle": return "bg-slate-500/80";
      case "path":     return "bg-amber-400 shadow-[0_0_4px_1px_rgba(251,191,36,0.35)]";
      case "visited":  return "bg-indigo-900/60";
      default:         return "bg-white/[0.03] hover:bg-white/[0.07]";
    }
  };

  const info = ALGO_INFO[algorithm];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-5 flex flex-col gap-4">

      {/* Top Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-3">

        {/* Algorithm */}
        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Algorithm</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(ALGO_INFO) as Algorithm[]).map(algo => {
              const a = ALGO_INFO[algo];
              const active = algorithm === algo;
              return (
                <button
                  key={algo}
                  onClick={() => { setAlgorithm(algo); handleReset(); }}
                  className={`relative px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 ${
                    active
                      ? `${a.badge} shadow-sm`
                      : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/10"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? a.dot : "bg-gray-600"}`}></span>
                  {a.name}
                </button>
              );
            })}
          </div>
          <div className={`mt-3 text-[11px] leading-relaxed px-1 ${
            algorithm === "astar" ? "text-cyan-400/80" :
            algorithm === "dijkstra" ? "text-violet-400/80" :
            algorithm === "bfs" ? "text-emerald-400/80" : "text-amber-400/80"
          }`}>
            {info.desc}
          </div>
        </div>

        {/* Tools */}
        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Drawing Tools</p>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all border flex items-center gap-2 ${
                  tool === t.id
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/10"
                }`}
              >
                <span className="text-sm leading-none">{t.icon}</span>
                <span>{t.label}</span>
                <span className="ml-auto text-[9px] text-gray-600 font-mono bg-white/5 px-1 py-0.5 rounded">{t.kbd}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={handleRandomObstacles}
              disabled={isRunning}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:border-white/10 disabled:opacity-30 transition-all"
            >
              🎲 Random Map
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-rose-400 hover:border-rose-500/30 transition-all"
            >
              🗑 Clear All
            </button>
          </div>
        </div>

        {/* Stats & Run */}
        <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06] flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Mission Control</p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Nodes", value: stats.nodesVisited, color: "text-cyan-400" },
              { label: "Steps", value: stats.pathLength || "—", color: "text-amber-400" },
              { label: "Compute", value: `${stats.timeMs}ms`, color: "text-violet-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.04] rounded-xl p-2.5 text-center border border-white/[0.04]">
                <div className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
              <span>Animation Speed</span>
              <span className="text-gray-300 font-medium">{speed}%</span>
            </div>
            <div className="relative">
              <input
                type="range" min={5} max={100} value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-auto">
            <button
              onClick={runAlgorithm}
              disabled={isRunning}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isRunning
                  ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20"
              }`}
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin"></span>
                  Running…
                </span>
              ) : "▶ Run"}
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning && !cancelRef.current}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.05] hover:bg-white/10 border border-white/[0.06] text-gray-300 transition-all"
            >
              ↺
            </button>
          </div>

          {stats.status === "found" && (
            <div className="text-[11px] text-center text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1.5">
              ✅ Path found! Robot delivered.
            </div>
          )}
          {stats.status === "no-path" && (
            <div className="text-[11px] text-center text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 rounded-lg py-1.5">
              ❌ No path available!
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white/[0.02] rounded-2xl border border-white/[0.05] p-3 overflow-auto">
        <div
          className="grid gap-[2px] select-none cursor-crosshair mx-auto"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`, maxWidth: "100%" }}
          onMouseLeave={() => { isMouseDown.current = false; }}
          onMouseUp={() => { isMouseDown.current = false; }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isRobot = robotPos && robotPos[0] === r && robotPos[1] === c;
              return (
                <div
                  key={`${r}-${c}`}
                  className={`aspect-square rounded-[3px] transition-all duration-75 flex items-center justify-center relative ${getCellStyle(cell, r, c)}`}
                  style={{ minWidth: "16px", minHeight: "16px" }}
                  onMouseDown={() => { isMouseDown.current = true; handleCellInteract(r, c); }}
                  onMouseEnter={() => { if (isMouseDown.current) handleCellInteract(r, c); }}
                >
                  {isRobot && <span className="text-xs leading-none select-none">🤖</span>}
                  {!isRobot && cell.type === "start" && <span className="text-[9px] font-bold text-white/90 leading-none">S</span>}
                  {!isRobot && cell.type === "end"   && <span className="text-[9px] font-bold text-white/90 leading-none">E</span>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend + Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex flex-wrap gap-3">
          {[
            { cls: "bg-emerald-500",    label: "Start" },
            { cls: "bg-rose-500",       label: "End" },
            { cls: "bg-slate-500/80",   label: "Obstacle" },
            { cls: "bg-indigo-900/60 border border-indigo-700/40", label: "Explored" },
            { cls: "bg-amber-400",      label: "Path" },
            { cls: "bg-yellow-300",     label: "Robot" },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <div className={`w-3 h-3 rounded-sm ${cls}`}></div>
              {label}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-600">Click or drag to draw · Select tool above</p>
      </div>

    </div>
  );
}
