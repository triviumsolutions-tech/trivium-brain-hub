"use client";

import { UploadCloud, Sparkles, Loader2, FileAudio } from "lucide-react";
import { useRef, useState } from "react";
import { Idea } from "@/types";

export function UploadModal({
  onUploadSuccess,
  existingProjects = [],
}: {
  onUploadSuccess: (data: { meetingMinutes?: string; suggestions: Partial<Idea>[] }) => void;
  existingProjects?: string[];
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("existingProjects", existingProjects.join(", "));

      const res = await fetch("/api/extract-ideas", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onUploadSuccess({
        meetingMinutes: data.meetingMinutes,
        suggestions: data.suggestions || data.ideas || [],
      });
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Erro ao processar áudio";
      alert("Erro ao processar áudio: " + message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      onClick={() => !isUploading && fileInputRef.current?.click()}
      className={`w-full border border-dashed border-purple-500/30 rounded-3xl p-8 flex flex-col items-center justify-center text-center bg-purple-500/[0.02] transition-colors group relative overflow-hidden ${
        isUploading ? "cursor-wait opacity-80" : "cursor-pointer hover:bg-purple-500/[0.05]"
      }`}
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
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
          <span className="text-xs font-mono text-purple-300 animate-pulse">
            Extraindo Ata & Sugestões para Quarentena...
          </span>
        </div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300 border border-white/5">
          <UploadCloud className="w-8 h-8 text-white/70 group-hover:text-purple-400 transition-colors" />
        </div>
      )}

      <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
        {isUploading
          ? "O Gemini está transcrevendo e estruturando a reunião..."
          : "Suba uma gravação para o Ouvido da Empresa"}
        {!isUploading && <Sparkles className="w-4 h-4 text-purple-400" />}
      </h3>
      <p className="text-white/40 text-sm max-w-lg">
        {isUploading
          ? "Separando ata histórica de tarefas acionáveis e associando aos projetos existentes..."
          : "Arquivos do Meet, Teams ou áudios gravados. A IA gera a ata da reunião e envia sugestões para Quarentena."}
      </p>

      {!isUploading && (
        <div className="mt-6 flex items-center gap-3 text-xs font-mono font-medium text-purple-300/50">
          <span className="bg-purple-500/10 px-2.5 py-1 rounded flex items-center gap-1.5">
            <FileAudio size={12} /> .mp3
          </span>
          <span className="bg-purple-500/10 px-2.5 py-1 rounded flex items-center gap-1.5">
            <FileAudio size={12} /> .mp4
          </span>
          <span className="bg-purple-500/10 px-2.5 py-1 rounded flex items-center gap-1.5">
            <FileAudio size={12} /> .wav
          </span>
          <span className="text-white/30">•</span>
          <span className="text-amber-400/80 font-sans text-xs">Regra de Quarentena ativa</span>
        </div>
      )}
    </div>
  );
}
