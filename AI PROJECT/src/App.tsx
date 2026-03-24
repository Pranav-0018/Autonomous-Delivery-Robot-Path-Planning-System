import PathPlanningSimulator from "./PathPlanningSimulator";

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-white/5 bg-[#0d0d14]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-base shadow-lg shadow-cyan-500/20">
              🤖
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight tracking-tight">PathBot Simulator</h1>
              <p className="text-[10px] text-gray-500 leading-tight">Autonomous Path Planning</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400"></span>
              <span>System Online</span>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <PathPlanningSimulator />
      </main>
    </div>
  );
}
