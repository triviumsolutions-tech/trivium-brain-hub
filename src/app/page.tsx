"use client";

import { useState, useEffect } from "react";
import { IdeaCard, Idea } from "@/components/IdeaCard";
import { UploadModal } from "@/components/UploadModal";
import { Mic, Search, X, Folder, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { collection, onSnapshot, query, orderBy, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Home() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [search, setSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [loadingDb, setLoadingDb] = useState(true);

  // Busca em tempo real do Firebase
  useEffect(() => {
    const q = query(collection(db, "ideas"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedIdeas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Idea[];
      setIdeas(fetchedIdeas);
      setLoadingDb(false);
    }, (error) => {
      console.error("Erro ao buscar ideias:", error);
      setTimeout(() => setLoadingDb(false), 0);
    });
    
    return () => unsub();
  }, []);

  // Simula o processamento do áudio, mas agora SALVA de verdade no Banco de Dados!
  const handleSimulateUpload = async () => {
    setIsUploading(true);
    setTimeout(async () => {
      try {
        await addDoc(collection(db, "ideas"), {
          title: "Ideia Extraída por IA (Teste)",
          project: "Upload Recente",
          status: "Nova",
          statusColor: "bg-emerald-500",
          desc: "Este card foi gerado a partir do seu último upload. Na versão final com a Gemini API conectada ao Next.js, o texto real da transcrição apareceria aqui.",
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Erro salvando fake upload", e);
        alert("Erro de permissão no Firebase. Certifique-se de que o Firestore está em modo de teste.");
      } finally {
        setIsUploading(false);
      }
    }, 3000);
  };

  const filteredIdeas = ideas.filter(idea => 
    idea.title?.toLowerCase().includes(search.toLowerCase()) || 
    idea.project?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Explorar Ideias</h1>
          <p className="text-white/50">Gerencie e evolua o conhecimento da Trivium.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="relative glass rounded-full px-4 py-2 flex items-center gap-2">
            <Search size={18} className="text-white/40" />
            <input 
              type="text" 
              placeholder="Buscar ideias, projetos..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-64 placeholder:text-white/30 text-white" 
            />
          </div>
          <Link href="/nova-ideia" className="bg-white text-black px-6 py-2 rounded-full font-medium text-sm hover:bg-white/90 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <Mic size={16} /> Nova Ideia Manual
          </Link>
        </div>
      </header>

      <div className="mb-12">
        <UploadModal onUpload={handleSimulateUpload} isUploading={isUploading} />
      </div>

      {loadingDb ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 mt-10">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-purple-400" />
          <h3 className="text-xl font-medium">Sincronizando dados...</h3>
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 mt-10">
          <Folder size={48} className="mb-4 text-white/30" />
          <h3 className="text-xl font-medium">O Hub está vazio</h3>
          <p className="text-sm mt-2 max-w-md">Você ainda não tem ideias cadastradas no Firebase. Crie a primeira ideia manual clicando lá em cima, ou faça o upload.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIdeas.map(idea => (
            <IdeaCard key={idea.id} idea={idea} onClick={() => setSelectedIdea(idea)} />
          ))}
        </div>
      )}
      
      {/* Modal / Canvas da Ideia */}
      {selectedIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-10 bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-4xl h-[80vh] rounded-3xl p-8 flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setSelectedIdea(null)} className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-2 rounded-full transition-colors">
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
            
            <div className="flex-1 w-full bg-black/30 border border-white/5 rounded-2xl p-6 mt-4">
              <p className="text-white/70 text-lg leading-relaxed whitespace-pre-wrap">
                {selectedIdea.desc}
              </p>
              
              <div className="mt-10 border-t border-white/10 pt-6">
                <h4 className="text-white/50 text-sm font-semibold mb-4 uppercase tracking-wider">Discussão & Notas do Canvas</h4>
                <textarea 
                  placeholder="Escreva novas anotações, adicione contextos ou desenvolva mais essa ideia aqui..." 
                  className="w-full h-32 bg-transparent border-none outline-none text-white placeholder:text-white/20 resize-none"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button className="bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Glow effect absolute background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
    </div>
  );
}
