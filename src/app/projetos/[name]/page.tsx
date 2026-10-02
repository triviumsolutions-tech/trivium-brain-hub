"use client";

import { useEffect, useState, use } from "react";
import { createPortal } from "react-dom";
import { collection, onSnapshot, query, where, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IdeaCard, Idea } from "@/components/IdeaCard";
import { ArrowLeft, Loader2, Search, Filter, Sparkles, Folder, X, PenTool, PlusCircle } from "lucide-react";
import Link from "next/link";
import { Whiteboard } from "@/components/Whiteboard";
import { NewIdeaModal } from "@/components/NewIdeaModal";

export default function ProjetoDetalhePage({ params }: { params: Promise<{ name: string }> }) {
  const resolvedParams = use(params);
  const projectName = decodeURIComponent(resolvedParams.name);
  
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);

  const [editNotes, setEditNotes] = useState("");
  const [isSavingIdea, setIsSavingIdea] = useState(false);

  // States para o Quadro Branco do PROJETO
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [projectDrawing, setProjectDrawing] = useState("");
  const [isSavingDrawing, setIsSavingDrawing] = useState(false);
  const [drawingLoaded, setDrawingLoaded] = useState(false);
  
  // State modal criação
  const [isNewIdeaModalOpen, setIsNewIdeaModalOpen] = useState(false);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const q = query(collection(db, "ideas"), where("project", "==", projectName));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedIdeas = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      })) as Idea[];
      
      fetchedIdeas.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setIdeas(fetchedIdeas);
      setLoading(false);
    });
    
    return () => unsub();
  }, [projectName]);

  // Carrega o desenho do projeto ao abrir o modal
  useEffect(() => {
    if (showWhiteboard && !drawingLoaded) {
      getDoc(doc(db, "projects", projectName)).then(document => {
        if (document.exists() && document.data().drawing) {
          setProjectDrawing(document.data().drawing);
        }
        setDrawingLoaded(true);
      });
    }
  }, [showWhiteboard, drawingLoaded, projectName]);

  const saveProjectCanvas = async (dataToSave: string) => {
    setIsSavingDrawing(true);
    try {
      await setDoc(doc(db, "projects", projectName), { drawing: dataToSave }, { merge: true });
      setShowWhiteboard(false);
    } catch (e) {
      console.error("Erro ao salvar desenho do projeto:", e);
      alert("Erro ao salvar o Quadro do Projeto.");
    } finally {
      setIsSavingDrawing(false);
    }
  };

  const openIdea = (idea: Idea) => {
    setSelectedIdea(idea);
    setEditNotes(idea.notes || "");
  };

  const saveIdea = async () => {
    if (!selectedIdea?.id) return;
    setIsSavingIdea(true);
    try {
      await updateDoc(doc(db, "ideas", selectedIdea.id), {
        notes: editNotes
      });
      setSelectedIdea(null);
    } catch (e) {
      console.error("Erro ao salvar ideia:", e);
      alert("Erro ao salvar a Ideia.");
    } finally {
      setIsSavingIdea(false);
    }
  };

  return (
    <>
      <NewIdeaModal isOpen={isNewIdeaModalOpen} onClose={() => setIsNewIdeaModalOpen(false)} defaultProject={projectName} />
      
      {/* Modal Tela Cheia do Quadro Branco do Projeto */}
      {showWhiteboard && mounted && createPortal(
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
          <header className="px-6 py-4 flex justify-between items-center bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white">
                <PenTool size={16} />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Quadro Branco: {projectName}</h3>
                <p className="text-xs text-white/50">Desenhe mapas mentais e arquiteturas para este projeto.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button onClick={() => setShowWhiteboard(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button 
                onClick={() => saveProjectCanvas(projectDrawing)}
                disabled={isSavingDrawing}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isSavingDrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Quadro"}
              </button>
            </div>
          </header>
          
          <div className="flex-1 w-full h-full p-2 relative overflow-hidden">
            {!drawingLoaded ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
              </div>
            ) : (
              <Whiteboard 
                initialData={projectDrawing}
                onSave={(data) => setProjectDrawing(data)}
              />
            )}
          </div>
        </div>,
        document.body
      )}

      <div className="p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
        <Link href="/projetos" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 text-sm font-medium w-fit">
          <ArrowLeft size={16} /> Voltar para o HUB de Projetos
        </Link>
      
      <header className="flex justify-between items-end mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Folder size={20} />
            </div>
            <h1 className="text-4xl font-bold">{projectName}</h1>
          </div>
          <p className="text-white/50 mt-4">Painel exclusivo para ideias, features e brainstorms ligados a este ecossistema.</p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setIsNewIdeaModalOpen(true)}
            className="px-6 py-2 bg-white text-black hover:bg-white/90 rounded-full font-medium flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all"
          >
            <PlusCircle size={16} /> Adicionar
          </button>
          <button 
            onClick={() => setShowWhiteboard(true)}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-full font-medium flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all"
          >
            <PenTool size={16} /> Lousa do Projeto
          </button>
          
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium flex items-center gap-2">
            <Filter size={16} className="text-white/40" /> 
            {ideas.length} Registros Encontrados
          </div>
        </div>
      </header>
      
      {loading ? (
         <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
         </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[40vh] glass rounded-3xl border border-dashed border-white/20">
          <Search size={48} className="text-white/20 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhuma ideia aqui</h3>
          <p className="text-white/40 text-center">Este quadro está vazio no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ideas.map(idea => (
            <IdeaCard key={idea.id} idea={idea} onClick={() => openIdea(idea)} />
          ))}
        </div>
      )}

      {/* Modal da Ideia Individual (Texto apenas) */}
      {selectedIdea && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-10 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-4xl h-[85vh] rounded-3xl p-8 flex flex-col relative animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <button onClick={() => setSelectedIdea(null)} className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-2 rounded-full transition-colors z-20">
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full">
                <Folder size={14} /> {selectedIdea.project}
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] ${selectedIdea.statusColor}`}></span>
                <span className="text-xs text-white/80">{selectedIdea.status}</span>
              </div>
            </div>

            <h2 className="text-4xl font-bold mb-4 flex items-center gap-3">
              {selectedIdea.title} <Sparkles className="text-purple-400 w-6 h-6" />
            </h2>
            
            <div className="flex-1 w-full bg-black/30 border border-white/5 rounded-2xl p-6 mt-4 overflow-y-auto">
              <div className="text-white/80 text-base leading-relaxed whitespace-pre-wrap">
                {selectedIdea.desc}
              </div>
              
              <div className="mt-10 border-t border-white/10 pt-6">
                <h4 className="text-white/50 text-sm font-semibold mb-4 uppercase tracking-wider">Discussão & Notas Adicionais</h4>
                <textarea 
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Escreva novas anotações, adicione contextos ou desenvolva mais essa ideia aqui..." 
                  className="w-full min-h-[120px] bg-white/5 rounded-xl border border-white/10 p-4 outline-none text-white placeholder:text-white/30 resize-y focus:border-purple-500/50 transition-colors"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button onClick={saveIdea} disabled={isSavingIdea} className="bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors shadow-[0_0_20px_rgba(147,51,234,0.3)] disabled:opacity-50 flex items-center gap-2">
                {isSavingIdea ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

        {/* Glow effect */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      </div>
    </>
  );
}
