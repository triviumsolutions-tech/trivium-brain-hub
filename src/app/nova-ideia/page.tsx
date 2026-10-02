"use client";

import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NovaIdeiaPage() {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [desc, setDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSave = () => {
    if (!title || !desc) {
      alert("Por favor, preencha o título e a descrição!");
      return;
    }
    
    setIsSubmitting(true);
    
    // Dispara pro banco de dados em background (Sem 'await')
    // O SDK do Firebase se vira pra garantir a entrega via socket, e a UI fica instantânea.
    addDoc(collection(db, "ideas"), {
      title,
      project: project || "Ideia Geral",
      desc,
      status: "Nova",
      statusColor: "bg-emerald-500",
      createdAt: new Date().toISOString()
    }).catch(e => console.error("Erro background:", e));
    
    // Já joga o usuário pra Home no mesmo milissegundo
    router.push("/");
  };

  return (
    <div className="p-10 max-w-3xl mx-auto h-full flex flex-col relative z-10">
      <header className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Criar Nova Ideia</h1>
        <p className="text-white/50">Formalize uma ideia manualmente e salve no banco de dados.</p>
      </header>
      <div className="glass rounded-3xl p-8 flex flex-col gap-6">
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
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Projeto Vinculado</label>
          <input 
            type="text" 
            value={project}
            onChange={e => setProject(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors" 
            placeholder="Ex: Trivium Core (deixe em branco se for geral)" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Fase (Ciclo de Vida)</label>
          <select 
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors"
            onChange={(e) => {
              // Hack rápido pro MVP: Salvar a fase no status pra exibir bonito no card
              const el = e.target;
              // A gente poderia adicionar um state novo "stage", mas vamos reaproveitar o visual do status
            }}
            id="fase-select"
          >
            <option value="Semente">🌱 Semente (Brainstorm Livre)</option>
            <option value="Projeto">🏗️ Projeto (Em Construção)</option>
            <option value="Produto">🚀 Produto (Já Lançado)</option>
            <option value="Feature">✨ Nova Feature / Melhoria</option>
          </select>
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
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Ideia"}
        </button>
      </div>
    </div>
  );
}
