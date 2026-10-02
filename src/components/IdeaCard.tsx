import { ArrowRight, Folder } from "lucide-react";

export function IdeaCard({ idea, onClick }: { idea: any, onClick?: () => void }) {
  return (
    <div onClick={onClick} className="glass glass-hover rounded-2xl p-6 flex flex-col group cursor-pointer h-64 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-2 text-xs font-medium text-white/60 bg-black/40 border border-white/5 px-3 py-1.5 rounded-full">
          <Folder size={12} className="text-purple-400" /> {idea.project}
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${idea.statusColor}`}></span>
          <span className="text-xs text-white/60">{idea.status}</span>
        </div>
      </div>
      
      <h3 className="text-lg font-semibold mb-2 group-hover:text-purple-300 transition-colors relative z-10">{idea.title}</h3>
      <p className="text-sm text-white/50 line-clamp-3 leading-relaxed flex-1 relative z-10">
        {idea.desc}
      </p>

      <div className="mt-4 flex justify-between items-center border-t border-white/5 pt-4 relative z-10">
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-black flex items-center justify-center text-[9px] font-bold">GS</div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-black flex items-center justify-center text-[9px] font-bold">TR</div>
        </div>
        <button className="text-xs font-medium text-purple-400/70 group-hover:text-purple-400 flex items-center gap-1 transition-colors">
          Abrir Canvas <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
