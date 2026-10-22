import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Server, Box, Package, Wrench, ClipboardCheck, Store,
  MapPin, Users, Download, Terminal, Settings, User, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { TerminalPanel } from '../components/Terminal';
import type { TreeNodeData } from '../types';

// --- NavItem ---
function NavItem({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `w-full flex items-center py-3 cursor-pointer relative transition-colors ${
          isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full" />}
          <div className="w-16 flex justify-center shrink-0">{icon}</div>
          <span className="whitespace-nowrap font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

// --- Header ---
function AppHeader() {
  const { tenantName, locTree } = useAppContext();
  const [orgPath, setOrgPath] = React.useState<{ id: string; label: string }[]>([]);
  const [locPath, setLocPath] = React.useState<{ id: string; label: string }[]>([]);
  const [showOrgPicker, setShowOrgPicker] = React.useState(false);
  const [showLocPicker, setShowLocPicker] = React.useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
      {/* Global Context Path */}
      <div className="flex items-center gap-1">
        {/* Tenant */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-md border border-transparent">
          <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
            {(tenantName || 'T').slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
            {tenantName || 'Tenant'}
          </span>
        </div>

        {/* Separator */}
        <ChevronRight size={16} className="text-slate-300 mx-0.5" />

        {/* Organization selector */}
        <div className="relative">
          <button
            onClick={() => setShowOrgPicker(!showOrgPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-700">
              {orgPath.length > 0 ? orgPath[orgPath.length - 1].label : 'All Organizations'}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {showOrgPicker && locTree.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-50 max-h-64 overflow-y-auto">
              <button
                onClick={() => { setOrgPath([]); setLocPath([]); setShowOrgPicker(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                All Organizations
              </button>
              {locTree[0]?.children?.map((org: TreeNodeData) => (
                <button
                  key={org.id}
                  onClick={() => { setOrgPath([{ id: org.id, label: org.label }]); setLocPath([]); setShowOrgPicker(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium"
                >
                  {org.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <ChevronRight size={16} className="text-slate-300 mx-0.5" />

        {/* Location selector */}
        <div className="relative">
          <button
            onClick={() => setShowLocPicker(!showLocPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
          >
            <span className="text-sm text-slate-600">
              {locPath.length > 0 ? locPath[locPath.length - 1].label : 'All Locations'}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `p-2 rounded-md transition-colors ${
              isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
            }`
          }
          title="Settings"
        >
          <Settings size={16} />
        </NavLink>
        <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded-md transition-colors ml-1">
          <span className="text-sm font-medium text-slate-700">ivan.stimac</span>
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 border border-slate-300">
            <User size={16} />
          </div>
        </div>
      </div>
    </header>
  );
}

// --- Main Layout ---
export default function AppLayout() {
  const { isTerminalOpen, setIsTerminalOpen } = useAppContext();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-slate-900 font-sans relative overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR PLACEHOLDER */}
        <div className="w-16 shrink-0 z-10 bg-slate-900 border-r border-slate-800" />

        {/* SIDEBAR */}
        <aside className="group absolute left-0 top-0 bottom-0 w-16 hover:w-64 transition-all duration-300 ease-in-out bg-slate-900 flex flex-col items-start py-6 border-r border-slate-800 z-50 overflow-hidden shadow-2xl hover:shadow-blue-900/20">
          {/* Logo */}
          <div className="h-8 mb-8 flex items-center w-full px-2 shrink-0">
            <svg
              width="177.181mm" height="60mm" viewBox="0 0 177.181 60"
              className="h-8 w-auto shrink-0 transition-transform duration-300 translate-x-4 group-hover:translate-x-0"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g transform="translate(-10,-10)">
                <g transform="matrix(0.12626263,0,0,0.12626263,6.9191919,6.9191919)">
                  <path d="M 98,460 64,426 227,262 64,98 98,64 294,262 Z" className="fill-blue-500" />
                  <path
                    d="M 44.427381,63.966667 V 39.973342 h 4.798665 v 23.993325 z m 15.000052,0 H 54.628767 V 39.469985 h 1.27517 L 68.01805,53.563967 V 40.006899 h 4.832222 v 24.463125 h -1.27517 L 59.427433,50.912956 Z M 75.769755,39.973342 h 5.536922 l 3.187924,7.986589 1.744969,4.966451 1.711412,-4.798665 3.221482,-8.154375 h 5.536921 L 86.776484,64.470024 H 85.702656 Z M 99.628824,63.966667 V 39.973342 h 12.013436 v 4.798665 h -7.21477 v 4.798665 h 6.30873 v 4.798665 h -6.30873 v 4.798665 h 7.61746 v 4.798665 z M 123.6557,54.805579 h -2.31544 v 9.161088 h -4.79867 V 39.973342 h 9.4631 q 2.24833,0 3.85907,1.04027 1.61074,1.04027 2.41611,2.718125 0.80537,1.644298 0.80537,3.523495 0,2.348997 -1.24161,4.261752 -1.24161,1.912754 -3.48994,2.550339 l 5.57048,9.899344 h -5.43625 z m 1.91275,-4.664436 q 1.1745,0 1.81209,-0.771814 0.63758,-0.80537 0.63758,-1.912754 0,-1.107384 -0.63758,-1.879198 -0.63759,-0.80537 -1.81209,-0.80537 h -4.22819 v 5.369136 z m 28.75846,5.469807 q 0,2.718125 -1.24161,4.664436 -1.20806,1.946312 -3.18793,2.919468 -1.97987,0.973156 -4.22819,0.973156 -2.24833,0 -4.26175,-0.973156 -1.97987,-0.973156 -3.22148,-2.919468 -1.20806,-1.946311 -1.20806,-4.664436 V 39.973342 h 4.79867 v 15.604051 q 0,1.778526 1.14094,2.785239 1.1745,0.973156 2.75168,0.973156 1.57718,0 2.71812,-0.973156 1.1745,-1.006713 1.1745,-2.785239 V 39.973342 h 4.76511 z m 25.77184,-16.006736 h 1.51007 v 24.362453 h -4.86578 l 0.0336,-13.389282 -6.14095,6.442963 -6.14095,-6.442963 v 13.389282 h -4.86578 V 39.604214 h 1.54363 l 9.4631,10.536929 z"
                    className="fill-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    transform="matrix(7.9199999,0,0,7.9199999,-54.799997,-54.799997)"
                  />
                </g>
              </g>
            </svg>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 w-full h-full overflow-x-hidden">
            <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" to="/dashboard" />
            <NavItem icon={<Server size={20} />} label="Assets" to="/assets" />
            <NavItem icon={<Box size={20} />} label="Boxes" to="/boxes" />
            <NavItem icon={<Package size={20} />} label="Supply" to="/supply" />
            <NavItem icon={<Wrench size={20} />} label="Work Orders" to="/work-orders" />
            <NavItem icon={<ClipboardCheck size={20} />} label="Checklists" to="/checklists" />
            <NavItem icon={<Store size={20} />} label="Vendors" to="/vendors" />

            <div className="mt-4 mb-1 relative h-4 flex items-center justify-center w-full">
              <div className="h-px bg-slate-800 w-8 group-hover:opacity-0 transition-opacity duration-300 absolute" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute left-4">
                System
              </span>
            </div>
            <NavItem icon={<MapPin size={20} />} label="Locations" to="/locations" />
            <NavItem icon={<Users size={20} />} label="Employees" to="/employees" />
            <NavItem icon={<Download size={20} />} label="Import" to="/import" />

            <div className="mt-auto mb-4 flex flex-col gap-2 w-full">
              <div onClick={() => setIsTerminalOpen(!isTerminalOpen)}>
                <div className={`w-full flex items-center py-3 cursor-pointer relative transition-colors ${isTerminalOpen ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {isTerminalOpen && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full" />}
                  <div className="w-16 flex justify-center shrink-0"><Terminal size={20} /></div>
                  <span className="whitespace-nowrap font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Terminal
                  </span>
                </div>
              </div>
            </div>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <AppHeader />
          <Outlet />
        </main>

        {/* Terminal Panel */}
        <TerminalPanel
          isOpen={isTerminalOpen}
          onToggle={() => setIsTerminalOpen(prev => !prev)}
          assets={[]}
          assetTypes={[]}
          viewPresets={[]}
        />
      </div>
    </div>
  );
}
