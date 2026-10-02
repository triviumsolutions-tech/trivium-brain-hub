"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, X } from "lucide-react";

interface NewIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProject?: string;
}

export function NewIdeaModal({ isOpen, onClose, defaultProject = "" }: NewIdeaModalProps) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState(defaultProject);
  const [desc, setDesc] = useState("");
  const [stage, setStage] = useState("Semente");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!isOpen || !mounted) return null;

  const handleSave = () => {
    if (!title || !desc) {
      alert("Por favor, preencha o título e a descrição!");
      return;
    }
    
    setIsSubmitting(true);
    
    let statusText = "Nova Ideia";
    let statusColor = "bg-emerald-500";
    
    if (stage === "Projeto") {
      statusText = "Em Construção";
      statusColor = "bg-blue-500";
    } else if (stage === "Produto") {
      statusText = "Ativo";
      statusColor = "bg-purple-500";
    } else if (stage === "Feature") {
      statusText = "Melhoria";
      statusColor = "bg-orange-500";
    }
    
    addDoc(collection(db, "ideas"), {
      title,
      project: project || "Ideia Geral",
      desc,
      status: statusText,
      statusColor,
      stage,
      createdAt: new Date().toISOString()
    }).then(() => {
      setIsSubmitting(false);
      onClose();
      setTitle("");
      setDesc("");
      setProject(defaultProject);
    }).catch(e => {
      console.error("Erro ao salvar:", e);
      setIsSubmitting(false);
      alert("Erro ao salvar no banco.");
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass w-full max-w-2xl rounded-3xl p-8 flex flex-col relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto shadow-2xl">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-2 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>
        
        <header className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Criar Nova Ideia</h2>
          <p className="text-white/50">Formalize uma ideia manualmente para o Hub.</p>
        </header>

        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Título da Ideia</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors" 
              placeholder="Ex: Novo dashboard de métricas" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Projeto Vinculado</label>
              <input 
                type="text" 
                value={project}
                onChange={e => setProject(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors" 
                placeholder="Ex: Trivium Core" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Fase (Ciclo de Vida)</label>
              <div className="relative">
                <select 
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/15 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors cursor-pointer appearance-none"
                >
                  <option value="Semente" className="bg-neutral-900 text-white py-2">🌱 Semente (Brainstorm)</option>
                  <option value="Projeto" className="bg-neutral-900 text-white py-2">🏗️ Projeto (Em Construção)</option>
                  <option value="Produto" className="bg-neutral-900 text-white py-2">🚀 Produto (Já Lançado)</option>
                  <option value="Feature" className="bg-neutral-900 text-white py-2">✨ Nova Feature / Melhoria</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/50">
                  ▼
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Descrição / Contexto</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full h-40 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors resize-none" 
              placeholder="Descreva a ideia de forma estruturada..." 
            />
          </div>
          <button 
            onClick={handleSave} 
            disabled={isSubmitting}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-xl mt-4 transition-colors shadow-[0_0_20px_rgba(147,51,234,0.3)] disabled:opacity-50 flex items-center justify-center"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Ideia no Hub"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
