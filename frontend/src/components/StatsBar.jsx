import { useStats } from '../hooks/usePhotos';
import { Camera, MapPin, MousePointerClick, HardDrive } from 'lucide-react';

function StatChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-surface-border bg-surface-card">
      <Icon size={12} className={color} />
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

function StorageBar({ storage }) {
  if (!storage) return null;
  const { usedMB, maxMB, percent } = storage;
  const barColor = percent > 90 ? 'from-red-500 to-red-400'
                 : percent > 70 ? 'from-amber-500 to-yellow-400'
                 : 'from-cyan-500 to-blue-500';
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-surface-border bg-surface-card min-w-[180px]">
      <HardDrive size={12} className="text-slate-400 shrink-0" />
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-semibold text-slate-300 whitespace-nowrap">
          {usedMB} / {maxMB} MB
        </span>
      </div>
    </div>
  );
}

export default function StatsBar() {
  const { stats, loading } = useStats();
  if (loading || !stats) return null;

  const { totals, storage } = stats;

  return (
    <div className="border-b border-surface-border bg-surface-card px-4 py-1.5 flex items-center gap-2 overflow-x-auto shrink-0">
      <StatChip icon={Camera}          label="Total"   value={totals.total}    color="text-slate-400" />
      <StatChip icon={MapPin}          label="On map"  value={totals.withGPS}  color="text-pin-exif"  />
      <StatChip icon={MousePointerClick} label="Manual" value={totals.manualPins} color="text-pin-manual" />
      <StorageBar storage={storage} />
    </div>
  );
}
