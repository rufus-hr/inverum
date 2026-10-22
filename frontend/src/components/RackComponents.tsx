import React, { useState } from 'react';
import { Server, Map, Maximize2, Settings2, Cpu, HardDrive, Activity, Lock, ShieldAlert } from 'lucide-react';

export function RacksDashboard() {
  const [selectedRack, setSelectedRack] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Server className="text-indigo-500" size={28} />
              Datacenter & Racks
            </h1>
            <p className="text-slate-500 mt-1">Manage floorplans, rack elevations, and power topology</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2">
              <Map size={18} />
              Edit Floorplan
            </button>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2">
              <Server size={18} />
              Add Rack
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Datacenter Floorplan (SVG Canvas Placeholder) */}
        <div className="w-1/2 border-r border-slate-200 bg-slate-100/50 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Server Room Alpha</h2>
            <div className="flex gap-2">
              <button className="p-2 bg-white rounded shadow-sm text-slate-500 hover:text-slate-700"><Settings2 size={16} /></button>
              <button className="p-2 bg-white rounded shadow-sm text-slate-500 hover:text-slate-700"><Maximize2 size={16} /></button>
            </div>
          </div>
          
          <div className="flex-1 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner">
            {/* Mockup of Floorplan */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            <div className="relative z-10 text-center">
              <Map size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-medium">Interactive Floorplan Canvas</p>
              <p className="text-xs text-slate-400 mt-2">SVG rendering of racks in the room</p>
              
              {/* Mock Racks on Floor */}
              <div className="mt-8 grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div 
                    key={i} 
                    onClick={() => setSelectedRack(`RACK-0${i}`)}
                    className={`w-16 h-20 rounded border-2 cursor-pointer transition-all flex items-center justify-center font-mono text-xs font-bold
                      ${selectedRack === `RACK-0${i}` ? 'bg-indigo-100 border-indigo-500 text-indigo-700 shadow-md scale-105' : 'bg-slate-50 border-slate-300 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50'}`}
                  >
                    R-0{i}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Rack Elevation (Front/Back SVG Placeholder) */}
        <div className="w-1/2 bg-white p-6 flex flex-col">
          {selectedRack ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{selectedRack}</h2>
                    {selectedRack === 'RACK-02' ? (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                        <Lock size={12} /> Level 5 Secure Rack
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
                        Level 2 Standard
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">42U Cabinet • 5kW Capacity</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button className="px-4 py-1.5 bg-white shadow-sm rounded-md text-sm font-bold text-slate-800">Front</button>
                  <button className="px-4 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700">Rear</button>
                </div>
              </div>

              <div className="flex-1 flex gap-8 justify-center overflow-y-auto pb-8">
                {/* Rack SVG Mockup */}
                <div className={`w-64 bg-slate-800 rounded-t-lg border-x-4 border-t-4 flex flex-col relative shadow-2xl ${selectedRack === 'RACK-02' ? 'border-red-900' : 'border-slate-900'}`}>
                  {/* U-Space Indicators */}
                  <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between py-2 text-[10px] font-mono text-slate-400">
                    <span>42</span>
                    <span>...</span>
                    <span>1</span>
                  </div>
                  
                  {/* Mock Equipment */}
                  <div className="h-12 bg-slate-700 border-b border-slate-900 mt-2 mx-1 rounded flex items-center px-3 gap-2">
                    <Activity size={14} className="text-emerald-400" />
                    <span className="text-xs font-mono text-slate-300">Switch (1U)</span>
                  </div>
                  <div className="h-24 bg-slate-600 border-b border-slate-900 mt-1 mx-1 rounded flex items-center px-3 gap-2">
                    <HardDrive size={14} className="text-blue-400" />
                    <span className="text-xs font-mono text-slate-200">Storage Array (2U)</span>
                  </div>
                  <div className="h-12 bg-slate-700 border-b border-slate-900 mt-1 mx-1 rounded flex items-center px-3 gap-2">
                    <Cpu size={14} className="text-emerald-400" />
                    <span className="text-xs font-mono text-slate-300">Server (1U)</span>
                  </div>
                  <div className="h-12 bg-slate-700 border-b border-slate-900 mt-1 mx-1 rounded flex items-center px-3 gap-2">
                    <Cpu size={14} className="text-emerald-400" />
                    <span className="text-xs font-mono text-slate-300">Server (1U)</span>
                  </div>
                  
                  {/* SECURE CAGE (Level 5) */}
                  <div className="mt-2 mx-1 border-2 border-red-900/80 rounded bg-slate-900 relative overflow-hidden flex flex-col shadow-inner">
                    {/* Mesh overlay simulation */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 1px, transparent 4px), repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 1px, transparent 4px)' }}></div>
                    
                    {/* Cage Header */}
                    <div className="bg-red-950/90 border-b border-red-900/50 px-2 py-1 flex items-center justify-between z-10">
                      <div className="flex items-center gap-1.5 text-red-400">
                        <Lock size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Secure Cage (8U)</span>
                      </div>
                      <span className="bg-red-500/20 text-red-300 text-[9px] px-1.5 py-0.5 rounded font-bold">LVL 5</span>
                    </div>
                    
                    {/* Cage Equipment */}
                    <div className="p-1 flex flex-col gap-1 z-10">
                      <div className="h-12 bg-slate-800 border border-slate-700 rounded flex items-center px-2 gap-2">
                        <ShieldAlert size={14} className="text-red-400" />
                        <span className="text-[10px] font-mono text-slate-300">HSM Crypto Node (1U)</span>
                      </div>
                      <div className="h-24 bg-slate-800 border border-slate-700 rounded flex items-center px-2 gap-2">
                        <HardDrive size={14} className="text-red-400" />
                        <span className="text-[10px] font-mono text-slate-300">Encrypted Vault (2U)</span>
                      </div>
                      <div className="h-12 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-slate-600">Empty (1U)</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Empty Space */}
                  <div className="flex-1 flex items-center justify-center min-h-[4rem]">
                    <span className="text-slate-500 font-mono text-xs">Available Space</span>
                  </div>

                  {/* UPS */}
                  <div className="h-24 bg-slate-900 border-t border-slate-950 mb-1 mx-1 rounded flex items-center justify-center">
                    <span className="text-xs font-mono text-slate-500">UPS (2U)</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Server size={64} className="mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">No Rack Selected</h3>
              <p className="text-sm text-center max-w-xs">Select a rack from the floorplan to view its front and rear elevations, equipment, and cabling.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RacksDashboard;
