import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Box, Download, MapPin, Users, Terminal,
  Settings, ShoppingCart, Archive, Wrench, ClipboardList,
  Building2, Briefcase,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { useTenantConfig } from '../../store/tenantConfig';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
}

const NavItem = ({ icon, label, to, onClick, active }: NavItemProps) => {
  const content = (isActive = false) => (
    <div className={`flex items-center gap-4 px-4 py-3 w-full transition-colors ${
      isActive || active
        ? 'text-blue-400 bg-slate-800/50 border-r-2 border-blue-500'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
    }`}>
      <div className="shrink-0">{icon}</div>
      <span className="font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {label}
      </span>
    </div>
  );

  if (to) {
    return (
      <NavLink to={to} className="w-full">
        {({ isActive }) => content(isActive)}
      </NavLink>
    );
  }

  return (
    <button onClick={onClick} className="w-full text-left">
      {content()}
    </button>
  );
};

const NavDivider = () => (
  <div className="mx-4 my-1 border-t border-slate-800/60" />
);

export default function Sidebar() {
  const { isTerminalOpen, setTerminalOpen } = useAppStore();
  const { modules } = useTenantConfig();

  return (
    <>
      {/* Placeholder drži layout */}
      <div className="w-16 shrink-0 z-10 bg-slate-900 border-r border-slate-800" />

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

        <nav className="flex flex-col gap-1 w-full h-full overflow-x-hidden">
          {/* Core — uvijek vidljivo */}
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" to="/" />
          <NavItem icon={<Box size={20} />} label="Assets" to="/assets" />
          <NavItem icon={<MapPin size={20} />} label="Locations" to="/locations" />
          <NavItem icon={<Building2 size={20} />} label="Workspaces" to="/workspaces" />
          <NavItem icon={<Users size={20} />} label="Employees" to="/employees" />

          {/* Moduli — vidljivi samo ako su uključeni */}
          {(modules.supplies || modules.storage || modules.vendors || modules.maintenance || modules.checklists) && (
            <NavDivider />
          )}
          {modules.supplies && (
            <NavItem icon={<ShoppingCart size={20} />} label="Supplies" to="/supply" />
          )}
          {modules.storage && (
            <NavItem icon={<Archive size={20} />} label="Storage & Boxes" to="/boxes" />
          )}
          {modules.vendors && (
            <NavItem icon={<Briefcase size={20} />} label="Vendors" to="/vendors" />
          )}
          {modules.maintenance && (
            <NavItem icon={<Wrench size={20} />} label="Maintenance" to="/work-orders" />
          )}
          {modules.checklists && (
            <NavItem icon={<ClipboardList size={20} />} label="Checklists" to="/checklists" />
          )}
          <NavItem icon={<ShoppingCart size={20} />} label="MSP Nabava" to="/procurement" />

          {/* Utility — uvijek na dnu */}
          <div className="mt-auto flex flex-col gap-1 w-full">
            <NavDivider />
            <NavItem icon={<Download size={20} />} label="Import" to="/import" />
            <NavItem
              icon={<Terminal size={20} />}
              label="CLI"
              active={isTerminalOpen}
              onClick={() => setTerminalOpen(true)}
            />
            <NavItem icon={<Settings size={20} />} label="Settings" to="/settings" />
          </div>
        </nav>
      </aside>
    </>
  );
}
