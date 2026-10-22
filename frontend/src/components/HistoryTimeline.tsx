import React from 'react';
import {
  Info, ShoppingCart, UserCheck, AlertCircle, Wrench, MapPin, Archive,
  CheckCircle2, User
} from 'lucide-react';

export function HistoryTimeline({ events }: { events: any[] }) {
  const reversedEvents = [...events].reverse();

  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Audit Log</h3>
      <div className="relative border-l-2 border-slate-200 ml-4">
        <div className="relative pl-6 mb-6">
          <div className="absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center shadow-sm bg-emerald-50 text-emerald-600 border-emerald-200">
            <CheckCircle2 size={10} />
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-emerald-900">Current Status: Active</h3>
              <p className="text-[10px] text-emerald-600 font-mono">Now</p>
            </div>
          </div>
        </div>

        {reversedEvents.map((log, index) => {
          const isLast = index === reversedEvents.length - 1;
          let Icon = Info;
          let colorClass = 'bg-slate-100 text-slate-500 border-slate-200';

          if (log.action.includes('Purchased') || log.action.includes('Onboarding')) {
            Icon = ShoppingCart; colorClass = 'bg-blue-50 text-blue-600 border-blue-200';
          } else if (log.action.includes('Assigned') || log.action.includes('Department')) {
            Icon = UserCheck; colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
          } else if (log.action.includes('Ticket') || log.action.includes('PEBCAK')) {
            Icon = AlertCircle; colorClass = 'bg-red-50 text-red-600 border-red-200';
          } else if (log.action.includes('Maintenance')) {
            Icon = Wrench; colorClass = 'bg-amber-50 text-amber-600 border-amber-200';
          } else if (log.action.includes('Location')) {
            Icon = MapPin; colorClass = 'bg-purple-50 text-purple-600 border-purple-200';
          } else if (log.action.includes('Returned')) {
            Icon = Archive; colorClass = 'bg-slate-50 text-slate-600 border-slate-200';
          }

          return (
            <div key={log.id} className={`relative pl-6 ${isLast ? '' : 'mb-6'}`}>
              <div className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center shadow-sm ${colorClass}`}>
                <Icon size={10} />
              </div>
              <div id={`audit-card-${log.id}`} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm transition-all duration-500">
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="text-sm font-bold text-slate-900">{log.action}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{log.date.split(' ')[0]}</p>
                </div>
                <div className="text-xs text-slate-600 mb-2">{log.details}</div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded inline-flex border border-slate-100">
                  <User size={10} /> {log.user}
                </div>
              </div>
            </div>
          );
        })}

        <div className="relative pl-6 mt-6">
          <div className="absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 border-emerald-500 bg-emerald-500 text-white flex items-center justify-center shadow-sm">
            <CheckCircle2 size={10} />
          </div>
          <div className="pt-0.5">
            <h3 className="text-sm font-bold text-emerald-600">Current Status: Active</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
