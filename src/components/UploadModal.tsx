"use client";
import { UploadCloud, Sparkles, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

export function UploadModal({ onUploadSuccess }: { onUploadSuccess: (ideas: any[]) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Envia o arquivo real para a nossa API do Next.js
      const res = await fetch("/api/extract-ideas", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Entrega o JSON com as ideias extraídas para a Home salvar no banco
      onUploadSuccess(data.ideas);
    } catch (error: any) {
      console.error(error);
      alert("Erro ao processar áudio: " + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div 
      onClick={() => !isUploading && fileInputRef.current?.click()}
      className={`w-full border border-dashed border-purple-500/30 rounded-3xl p-8 flex flex-col items-center justify-center text-center bg-purple-500/[0.02] transition-colors group relative overflow-hidden ${isUploading ? 'cursor-wait opacity-80' : 'cursor-pointer hover:bg-purple-500/[0.05]'}`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="audio/*,video/mp4" 
      />

      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      
      {isUploading ? (
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300 border border-white/5">
          <UploadCloud className="w-8 h-8 text-white/70 group-hover:text-purple-400 transition-colors" />
        </div>
      )}

      <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
        {isUploading ? "O Gemini está extraindo insights da reunião..." : "Suba uma gravação para extrair ideias"} 
        {!isUploading && <Sparkles className="w-4 h-4 text-purple-400" />}
      </h3>
      <p className="text-white/40 text-sm max-w-lg">
        {isUploading 
          ? "Isso leva alguns segundos. O áudio está sendo processado na nuvem do Google." 
          : "Clique ou arraste arquivos de vídeo/áudio do Meet, Teams ou do celular. Nossa IA vai transcrever e criar automaticamente os cards."}
      </p>
      
      {!isUploading && (
        <div className="mt-6 flex gap-3 text-xs font-mono font-medium text-purple-300/50">
          <span className="bg-purple-500/10 px-2 py-1 rounded">.mp4</span>
          <span className="bg-purple-500/10 px-2 py-1 rounded">.mp3</span>
          <span className="bg-purple-500/10 px-2 py-1 rounded">.wav</span>
        </div>
      )}
    </div>
  );
}
