import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X } from 'lucide-react';
import type { Asset } from '../types';

type TerminalLine = { type: 'input' | 'output' | 'error' | 'system'; text: React.ReactNode };

interface ViewPreset {
  id: string;
  name: string;
  columns: string[];
}

interface TerminalProps {
  isOpen: boolean;
  onToggle: () => void;
  assets: Asset[];
  assetTypes: string[];
  viewPresets: ViewPreset[];
  onFilterType?: (type: string) => void;
  onSelectAsset?: (assetId: string) => void;
  onApplyPreset?: (presetId: string) => void;
}

export function TerminalPanel({
  isOpen, onToggle, assets, assetTypes, viewPresets,
  onFilterType, onSelectAsset, onApplyPreset,
}: TerminalProps) {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: 'system', text: 'INVERUM OS v2.4.1-enterprise (tty1)' },
    { type: 'system', text: 'Type "help" for a list of available commands.' },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const KNOWN_COMMANDS = [
    'help', 'clear', 'exit', 'filter', 'select', 'wipe', 'sudo',
    'export', 'email', 'file', 'view', 'save', 'load', 'list',
    'Server', 'Laptop', 'Desktop', 'csv', 'json', 'ivan.stimac@hp.hr',
  ];

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history, isOpen]);

  useEffect(() => {
    if (!isOpen) inputRef.current?.blur();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === 'k')) {
        e.preventDefault();
        onToggle();
        if (!isOpen) setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const words = input.split(' ');
      const lastWord = words[words.length - 1];
      if (!lastWord) return;
      const match = KNOWN_COMMANDS.find(c => c.toLowerCase().startsWith(lastWord.toLowerCase()));
      if (match) {
        words[words.length - 1] = match;
        setInput(words.join(' ') + ' ');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const handleClick = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      navigator.clipboard.writeText(selection.toString());
    } else {
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const rawInput = input.trim();
    setCommandHistory(prev => [...prev, rawInput]);
    setHistoryIndex(-1);

    let lines: TerminalLine[] = [...history, { type: 'input', text: `root@inverum:~# ${rawInput}` }];
    const commands = rawInput.split(/(&&|\|)/).map(t => t.trim()).filter(Boolean);

    let pipeActive = false;
    let pipedData: any = null;

    for (let i = 0; i < commands.length; i++) {
      const cmdStr = commands[i];
      if (cmdStr === '&&') { pipeActive = false; continue; }
      if (cmdStr === '|') { pipeActive = true; lines.push({ type: 'system', text: '  | piping stdout...' }); continue; }

      const args = cmdStr.split(' ');
      const command = args[0].toLowerCase();

      switch (command) {
        case 'help':
          lines.push({ type: 'output', text: 'Available commands:' });
          lines.push({ type: 'output', text: '  filter <type>   - Filter assets by type (e.g., filter Laptop)' });
          lines.push({ type: 'output', text: '  select <id>     - Select an asset by ID (e.g., select INV-1002)' });
          lines.push({ type: 'output', text: '  wipe <id>       - Initiate NIST 800-88 wipe protocol' });
          lines.push({ type: 'output', text: '  export <fmt>    - Export current view (csv, json)' });
          lines.push({ type: 'output', text: '  email <addr>    - Send piped data to email' });
          lines.push({ type: 'output', text: '  file <path>     - Save piped data to file' });
          lines.push({ type: 'output', text: '  view <cmd>      - Manage views (save <name>, load <name>, list)' });
          lines.push({ type: 'output', text: '  clear           - Clear terminal output' });
          lines.push({ type: 'output', text: '  exit            - Close terminal' });
          break;
        case 'clear':
          setHistory([]);
          setInput('');
          return;
        case 'exit':
          onToggle();
          setInput('');
          return;
        case 'filter':
          if (args[1]) {
            const type = args.slice(1).join(' ');
            const matchedType = assetTypes.find(t => t.toLowerCase() === type.toLowerCase());
            if (matchedType) {
              onFilterType?.(matchedType);
              lines.push({ type: 'output', text: `[OK] Filter applied: ${matchedType}` });
            } else {
              lines.push({ type: 'error', text: `[ERROR] Unknown asset type: ${type}` });
            }
          } else {
            lines.push({ type: 'error', text: 'Usage: filter <type>' });
          }
          break;
        case 'select':
          if (args[1]) {
            const id = args[1].toUpperCase();
            const asset = assets.find(a => a.inventoryNumber === id || a.id === id);
            if (asset) {
              onSelectAsset?.(asset.id);
              lines.push({ type: 'output', text: `[OK] Asset selected: ${asset.inventoryNumber} (${asset.name})` });
              pipedData = asset;
            } else {
              lines.push({ type: 'error', text: `[ERROR] Asset not found: ${id}` });
            }
          } else {
            lines.push({ type: 'error', text: 'Usage: select <id>' });
          }
          break;
        case 'json':
          if (pipeActive && pipedData) {
            JSON.stringify(pipedData, null, 2).split('\n').forEach(line => {
              lines.push({ type: 'output', text: line });
            });
          } else {
            lines.push({ type: 'error', text: '[ERROR] No data piped to json formatter.' });
          }
          break;
        case 'wipe':
          if (args[1]) {
            const id = args[1].toUpperCase();
            lines.push({ type: 'system', text: `[WARNING] Initiating NIST 800-88 Purge protocol for ${id}...` });
            lines.push({ type: 'output', text: '> Overwriting sectors (Pass 1/3) - Random data... OK' });
            lines.push({ type: 'output', text: '> Overwriting sectors (Pass 2/3) - Zeros... OK' });
            lines.push({ type: 'output', text: '> Overwriting sectors (Pass 3/3) - Verification... OK' });
            lines.push({ type: 'system', text: '[SUCCESS] Cryptographic erase verified. Certificate generated.' });
          } else {
            lines.push({ type: 'error', text: 'Usage: wipe <id>' });
          }
          break;
        case 'export': {
          const fmt = args[1] || 'csv';
          lines.push({ type: 'output', text: `[OK] Exporting active dataset to ${fmt.toUpperCase()} format...` });
          lines.push({ type: 'output', text: `[OK] Generated ${fmt.toUpperCase()} payload (2.4MB)` });
          break;
        }
        case 'email':
          if (args[1]) {
            if (!pipeActive) lines.push({ type: 'system', text: '[WARN] No piped input detected. Sending empty body.' });
            lines.push({ type: 'output', text: '[OK] Connecting to SMTP relay...' });
            lines.push({ type: 'output', text: `[OK] Payload dispatched to ${args[1]}` });
          } else {
            lines.push({ type: 'error', text: 'Usage: email <address>' });
          }
          break;
        case 'file':
          if (args[1]) {
            if (!pipeActive) lines.push({ type: 'system', text: '[WARN] No piped input detected. Writing empty file.' });
            lines.push({ type: 'output', text: `[OK] Writing stream to ${args[1]}...` });
            lines.push({ type: 'output', text: '[OK] File saved successfully.' });
          } else {
            lines.push({ type: 'error', text: 'Usage: file <path>' });
          }
          break;
        case 'view':
          if (args[1] === 'list') {
            lines.push({ type: 'output', text: 'Available View Presets:' });
            viewPresets.forEach(p => {
              lines.push({ type: 'output', text: `  - ${p.name} (${p.columns.join(', ')})` });
            });
          } else if (args[1] === 'save') {
            const nameMatch = cmdStr.match(/save\s+(?:"([^"]+)"|(\S+))/);
            const presetName = nameMatch ? (nameMatch[1] || nameMatch[2]) : null;
            if (presetName) {
              lines.push({ type: 'output', text: `[OK] Saved current column configuration as preset: ${presetName}` });
            } else {
              lines.push({ type: 'error', text: 'Usage: view save <preset_name>' });
            }
          } else if (args[1] === 'load') {
            const nameMatch = cmdStr.match(/load\s+(?:"([^"]+)"|(\S+))/);
            const presetName = nameMatch ? (nameMatch[1] || nameMatch[2]) : null;
            if (presetName) {
              const preset = viewPresets.find(p => p.name.toLowerCase() === presetName.toLowerCase());
              if (preset) {
                onApplyPreset?.(preset.id);
                lines.push({ type: 'output', text: `[OK] Loaded preset: ${preset.name}` });
              } else {
                lines.push({ type: 'error', text: `[ERROR] Preset not found: ${presetName}` });
              }
            } else {
              lines.push({ type: 'error', text: 'Usage: view load <preset_name>' });
            }
          } else {
            lines.push({ type: 'error', text: 'Usage: view <save name | load name | list>' });
          }
          break;
        case 'sudo':
          lines.push({ type: 'error', text: 'nice try.' });
          break;
        default:
          lines.push({ type: 'error', text: `Command not found: ${command}. Type "help" for available commands.` });
      }
    }

    setHistory(lines);
    setInput('');
  };

  return (
    <div
      className={`fixed bottom-0 left-16 right-0 bg-slate-950 border-t border-slate-800 font-mono text-sm transition-all duration-300 ease-in-out z-50 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)]
        ${isOpen ? 'h-72 translate-y-0' : 'h-72 translate-y-full'}`}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 text-xs select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-emerald-500" />
          <span>INVERUM CLI <span className="text-slate-600 ml-2">Press Ctrl+K to toggle</span></span>
        </div>
        <button onClick={onToggle} className="hover:text-white transition-colors p-1 hover:bg-slate-800 rounded">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 text-sm" onClick={handleClick}>
        {history.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap
            ${line.type === 'input' ? 'text-slate-300' : ''}
            ${line.type === 'output' ? 'text-emerald-400' : ''}
            ${line.type === 'error' ? 'text-red-400' : ''}
            ${line.type === 'system' ? 'text-blue-400 font-bold' : ''}
          `}>
            {line.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center px-4 py-3 bg-slate-900/50 border-t border-slate-800/50">
        <span className="text-emerald-500 mr-2 font-bold">root@inverum:~#</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-slate-200 placeholder-slate-700"
          placeholder="Type a command..."
          autoComplete="off"
          spellCheck="false"
        />
      </form>
    </div>
  );
}
