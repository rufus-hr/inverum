import { create } from 'zustand';

interface AppState {
  isTerminalOpen: boolean;
  toggleTerminal: () => void;
  setTerminalOpen: (isOpen: boolean) => void;
  
  // We can add more global state here later
  // e.g., activeTenant, user, etc.
}

export const useAppStore = create<AppState>((set) => ({
  isTerminalOpen: false,
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
  setTerminalOpen: (isOpen) => set({ isTerminalOpen: isOpen }),
}));
