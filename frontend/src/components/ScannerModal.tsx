import React, { useState, useEffect, useRef } from 'react';
import { X, ScanLine, ArrowRight, CheckCircle2, AlertCircle, Box, Server, Layers, MapPin } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EntityType = 'A' | 'B' | 'R' | 'S' | 'L';

interface ScannedEntity {
  rawCode: string;
  type: EntityType;
  id: string;
  name: string; // Mocked name for UI feedback
}

export function ScannerPlacementModal({ isOpen, onClose }: ScannerModalProps) {
  const [scannedItems, setScannedItems] = useState<ScannedEntity[]>([]);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the hidden input when modal opens to catch hardware scanner input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setScannedItems([]);
      setScanStatus('idle');
    }
  }, [isOpen]);

  // Keep focus on input if user clicks elsewhere in the modal
  const handleModalClick = () => {
    inputRef.current?.focus();
  };

  const getEntityIcon = (type: EntityType) => {
    switch (type) {
      case 'A': return <Server size={16} className="text-blue-500" />;
      case 'B': return <Box size={16} className="text-amber-500" />;
      case 'R': return <Server size={16} className="text-indigo-500" />;
      case 'S': return <Layers size={16} className="text-emerald-500" />;
      case 'L': return <MapPin size={16} className="text-slate-500" />;
      default: return <ScanLine size={16} />;
    }
  };

  const getEntityTypeName = (type: EntityType) => {
    switch (type) {
      case 'A': return 'Asset';
      case 'B': return 'Box';
      case 'R': return 'Rack';
      case 'S': return 'Storage';
      case 'L': return 'Location';
      default: return 'Unknown';
    }
  };

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const code = e.currentTarget.value.trim().toUpperCase();
      e.currentTarget.value = ''; // Clear input immediately
      
      if (code.length !== 7) {
        setScanStatus('error');
        setErrorMessage(`Invalid code length: ${code.length}/7`);
        setTimeout(() => setScanStatus('idle'), 2000);
        return;
      }

      const type = code.charAt(0) as EntityType;
      const validTypes = ['A', 'B', 'R', 'S', 'L'];
      
      if (!validTypes.includes(type)) {
        setScanStatus('error');
        setErrorMessage(`Invalid entity type: ${type}`);
        setTimeout(() => setScanStatus('idle'), 2000);
        return;
      }

      // Mock database lookup
      const newEntity: ScannedEntity = {
        rawCode: code,
        type,
        id: code.substring(1),
        name: `${getEntityTypeName(type)} ${code.substring(1, 4)}`
      };

      setScannedItems(prev => [...prev, newEntity]);
      setScanStatus('success');
      setTimeout(() => setScanStatus('idle'), 1000);
    }
  };

  const handleExecute = () => {
    // In a real app, this would send the payload to the backend
    console.log('Executing placement:', scannedItems);
    setScanStatus('success');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  // Logic to determine what action is being performed based on scanned items
  let actionDescription = "Scan items to begin";
  let canExecute = false;

  if (scannedItems.length === 1) {
    actionDescription = `Moving ${scannedItems[0].name}... Scan destination.`;
  } else if (scannedItems.length >= 2) {
    const source = scannedItems.slice(0, -1).map(i => i.name).join(', ');
    const destination = scannedItems[scannedItems.length - 1];
    actionDescription = `Place ${source} INTO ${destination.name}`;
    canExecute = true;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleModalClick}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Hidden input to capture hardware scanner keystrokes */}
        <input 
          ref={inputRef}
          type="text" 
          className="opacity-0 absolute w-0 h-0" 
          onKeyDown={handleScan}
          autoComplete="off"
        />

        {/* Header */}
        <div className="bg-slate-900 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${scanStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400' : scanStatus === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
              <ScanLine size={24} className={scanStatus === 'scanning' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Rapid Scanner</h2>
              <p className="text-xs text-slate-400 font-mono">Awaiting 7-char Base32 input...</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Action Status Bar */}
        <div className={`p-3 text-center font-bold text-sm border-b ${
          scanStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          canExecute ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
          'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          {scanStatus === 'error' ? (
            <span className="flex items-center justify-center gap-2"><AlertCircle size={16} /> {errorMessage}</span>
          ) : (
            actionDescription
          )}
        </div>

        {/* Scanned Items List */}
        <div className="p-6 bg-slate-50 flex-1 min-h-[300px] flex flex-col gap-3">
          {scannedItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <ScanLine size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Ready to scan</p>
              <p className="text-xs mt-2">Scan an Asset, Box, or Rack</p>
            </div>
          ) : (
            <>
              {scannedItems.map((item, index) => {
                const isLast = index === scannedItems.length - 1;
                const isDestination = scannedItems.length > 1 && isLast;

                return (
                  <div key={index} className="flex items-center gap-3">
                    {/* Connection Line/Arrow */}
                    {index > 0 && (
                      <div className="flex flex-col items-center justify-center w-8">
                        <div className="w-0.5 h-4 bg-slate-300"></div>
                        <ArrowRight size={16} className="text-slate-400 my-1" />
                        <div className="w-0.5 h-4 bg-slate-300"></div>
                      </div>
                    )}
                    
                    {/* Item Card */}
                    <div className={`flex-1 flex items-center justify-between p-3 rounded-lg border shadow-sm ${
                      isDestination ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded bg-slate-100 ${isDestination ? 'bg-emerald-100' : ''}`}>
                          {getEntityIcon(item.type)}
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isDestination ? 'text-emerald-900' : 'text-slate-900'}`}>
                            {item.name}
                          </p>
                          <p className="text-xs font-mono text-slate-500">{item.rawCode}</p>
                        </div>
                      </div>
                      
                      {isDestination && (
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                          Destination
                        </span>
                      )}
                      {!isDestination && scannedItems.length > 1 && (
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          Payload
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
          <button 
            onClick={() => setScannedItems([])}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={scannedItems.length === 0}
          >
            Clear All
          </button>
          
          <button 
            onClick={handleExecute}
            disabled={!canExecute}
            className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              canExecute 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {scanStatus === 'success' && canExecute ? (
              <><CheckCircle2 size={18} /> Executed</>
            ) : (
              <><ArrowRight size={18} /> Execute Placement</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
