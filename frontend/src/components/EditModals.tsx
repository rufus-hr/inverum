import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

interface EditLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string | null;
  onSave: (id: string, data: any) => void;
}

export function EditLocationModal({ isOpen, onClose, locationId, onSave }: EditLocationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Room');
  const [gridCols, setGridCols] = useState(1);
  const [gridRows, setGridRows] = useState(1);

  useEffect(() => {
    if (isOpen && locationId) {
      // In a real app, fetch location details. For now, mock it.
      setName(`Location ${locationId}`);
      setDescription('A description for this location.');
      
      if (locationId.startsWith('cab') || locationId.startsWith('safe') || locationId.startsWith('shelf')) {
        setType('Storage Unit');
        setGridCols(3);
        setGridRows(4);
      } else if (locationId.startsWith('rack')) {
        setType('Rack');
      } else if (locationId.startsWith('ws')) {
        setType('Workspace');
      } else {
        setType('Room');
      }
    }
  }, [isOpen, locationId]);

  const handleSave = () => {
    if (locationId) {
      onSave(locationId, { name, description, type, gridConfig: type === 'Storage Unit' ? { cols: gridCols, rows: gridRows } : undefined });
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit Location</h3>
            <p className="text-xs text-slate-500 mt-1">Update location details and hierarchy</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-md hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
            <select 
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white appearance-none"
            >
              <option value="Building">Building</option>
              <option value="Floor">Floor</option>
              <option value="Room">Room</option>
              <option value="Storage Unit">Storage Unit (Cabinet, Shelf)</option>
              <option value="Rack">Rack</option>
              <option value="Workspace">Workspace</option>
            </select>
          </div>

          {type === 'Storage Unit' && (
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Internal Structure (Grid)</label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Columns</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={gridCols}
                    onChange={e => setGridCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rows</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20"
                    value={gridRows}
                    onChange={e => setGridRows(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Grid Preview */}
              {(gridCols > 1 || gridRows > 1) && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Structure Preview</p>
                  <div 
                    className="grid gap-1" 
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: Math.min(gridRows, 5) }).map((_, r) => (
                      Array.from({ length: Math.min(gridCols, 5) }).map((_, c) => (
                        <div key={`${r}-${c}`} className="bg-white border border-slate-200 rounded text-[9px] font-mono text-slate-400 flex items-center justify-center py-1">
                          {String.fromCharCode(65 + c)}{r + 1}
                        </div>
                      ))
                    ))}
                  </div>
                  {(gridRows > 5 || gridCols > 5) && (
                    <p className="text-[9px] text-slate-400 mt-2 text-center italic">Preview limited to 5x5</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white resize-none"
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20">
            <Save size={16} /> Save
          </button>
        </div>
      </div>
    </>
  );
}

interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  onSave: (parentId: string, data: any) => void;
}

export function AddEntityModal({ isOpen, onClose, parentId, onSave }: AddEntityModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState('Location');
  const [locationType, setLocationType] = useState('Room'); // Only if entityType === 'Location'
  const [storageType, setStorageType] = useState('Rack'); // Only if entityType === 'Storage Unit'
  const [securityLevel, setSecurityLevel] = useState(1); // Only if entityType === 'Storage Unit'
  const [gridCols, setGridCols] = useState(1);
  const [gridRows, setGridRows] = useState(1);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setEntityType('Location');
      setLocationType('Room');
      setStorageType('Rack');
      setSecurityLevel(1);
      setGridCols(1);
      setGridRows(1);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (parentId && name.trim()) {
      onSave(parentId, { 
        name, 
        description, 
        entityType, 
        locationType: entityType === 'Location' ? locationType : undefined,
        storageType: entityType === 'Storage Unit' ? storageType : undefined,
        securityLevel: entityType === 'Storage Unit' ? securityLevel : undefined,
        gridConfig: entityType === 'Storage Unit' ? { cols: gridCols, rows: gridRows } : undefined
      });
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add New Item</h3>
            <p className="text-xs text-slate-500 mt-1">Add a child entity to the selected item</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-md hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Entity Type</label>
            <select 
              value={entityType}
              onChange={e => setEntityType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white appearance-none"
            >
              <option value="Location">Location (Building, Floor, Room)</option>
              <option value="Storage Unit">Storage Unit (Rack, Cabinet, Safe)</option>
              <option value="Workspace">Workspace</option>
            </select>
          </div>

          {entityType === 'Location' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location Type</label>
              <select 
                value={locationType}
                onChange={e => setLocationType(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white appearance-none"
              >
                <option value="Building">Building</option>
                <option value="Floor">Floor</option>
                <option value="Room">Room</option>
              </select>
            </div>
          )}

          {entityType === 'Storage Unit' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Storage Type</label>
                <select 
                  value={storageType}
                  onChange={e => setStorageType(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white appearance-none"
                >
                  <option value="Rack">Rack (Open)</option>
                  <option value="Shelf">Shelf</option>
                  <option value="Cabinet">Cabinet (Lockable)</option>
                  <option value="Safe">Safe</option>
                  <option value="Cage">Cage / Vault</option>
                  <option value="Drawer">Drawer</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Security Level</label>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Level {securityLevel}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  value={securityLevel}
                  onChange={e => setSecurityLevel(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium px-1">
                  <span>1 (Open)</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5 (Max)</span>
                </div>
              </div>

              {/* Grid Configuration */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Internal Structure (Grid)</label>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Columns</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10"
                      value={gridCols}
                      onChange={e => setGridCols(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rows</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={gridRows}
                      onChange={e => setGridRows(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Grid Preview */}
                {(gridCols > 1 || gridRows > 1) && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Structure Preview</p>
                    <div 
                      className="grid gap-1" 
                      style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: Math.min(gridRows, 5) }).map((_, r) => (
                        Array.from({ length: Math.min(gridCols, 5) }).map((_, c) => (
                          <div key={`${r}-${c}`} className="bg-white border border-slate-200 rounded text-[9px] font-mono text-slate-400 flex items-center justify-center py-1">
                            {String.fromCharCode(65 + c)}{r + 1}
                          </div>
                        ))
                      ))}
                    </div>
                    {(gridRows > 5 || gridCols > 5) && (
                      <p className="text-[9px] text-slate-400 mt-2 text-center italic">Preview limited to 5x5</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name / Identifier</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Enter ${entityType.toLowerCase()} name...`}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Add any additional details..."
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white resize-none"
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={!name.trim()}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20"
          >
            <Save size={16} /> Add {entityType}
          </button>
        </div>
      </div>
    </>
  );
}

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  onSave: (id: string, data: any) => void;
  initialData?: any;
}

export function EditEmployeeModal({ isOpen, onClose, employeeId, onSave, initialData }: EditEmployeeModalProps) {
  const [pebcakScore, setPebcakScore] = useState(0);
  const [internalTags, setInternalTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [status, setStatus] = useState('Active');

  useEffect(() => {
    if (isOpen && initialData) {
      setPebcakScore(initialData.pebcak_score || 0);
      setInternalTags(initialData.internal_tags || []);
      setStatus(initialData.status || 'Active');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (employeeId) {
      onSave(employeeId, { pebcak_score: pebcakScore, internal_tags: internalTags, status });
      onClose();
    }
  };

  const addTag = () => {
    if (newTag.trim() && !internalTags.includes(newTag.trim())) {
      setInternalTags([...internalTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setInternalTags(internalTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Slide-out Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit Employee</h3>
            <p className="text-xs text-slate-500 mt-1">Manage internal Inverum attributes</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-md hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3 shrink-0">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Note:</strong> Core profile attributes (Name, Email, Department) are synced from SSO and cannot be edited here.
          </p>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">User Status</label>
            <select 
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white appearance-none"
            >
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <span>PEBCAK Score</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${pebcakScore > 5 ? 'bg-red-100 text-red-700' : pebcakScore > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {pebcakScore}
              </span>
            </label>
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="0" 
                max="10" 
                value={pebcakScore}
                onChange={e => setPebcakScore(parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Problem Exists Between Chair And Keyboard. Higher score indicates more frequent user errors.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Internal Tags</label>
            <div className="flex gap-2 mb-3">
              <input 
                type="text" 
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="e.g. handle_with_care"
                className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50 hover:bg-white focus:bg-white"
              />
              <button onClick={addTag} className="px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {internalTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-200">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
              {internalTags.length === 0 && (
                <span className="text-xs text-slate-400 italic">No tags assigned</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20">
            <Save size={16} /> Save
          </button>
        </div>
      </div>
    </>
  );
}
