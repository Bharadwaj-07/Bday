import { Upload, PanelLeftClose, PanelLeftOpen, MapPin } from 'lucide-react';

export default function TopBar({ onUpload, onToggleSidebar, sidebarOpen, pinCount }) {
  return (
    <header className="glass z-[900] flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
      {/* Left – brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-lg shadow-accent/30">
            <MapPin size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-none text-white">PhotoMap</h1>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">World Photo Explorer</p>
          </div>
        </div>

        <span className="hidden sm:flex text-xs text-slate-500 bg-surface-hover px-2 py-0.5 rounded-full border border-surface-border">
          {pinCount} pin{pinCount !== 1 ? 's' : ''} on map
        </span>
      </div>

      {/* Right – actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onUpload}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dark transition-colors
                     text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg shadow-accent/25"
        >
          <Upload size={15} />
          <span className="hidden sm:inline">Upload</span>
        </button>

        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>
    </header>
  );
}
