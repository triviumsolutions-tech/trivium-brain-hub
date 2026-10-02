"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Folder, Loader2, Lightbulb } from "lucide-react";
import Link from "next/link";

interface Idea {
  project: string;
}

export default function ProjetosPage() {
  const [projects, setProjects] = useState<{name: string, ideaCount: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "ideas"));
    const unsub = onSnapshot(q, (snapshot) => {
      const allIdeas = snapshot.docs.map(doc => doc.data() as Idea);
      
      // Agrupa e conta quantas ideias cada projeto tem
      const projectMap = new Map<string, number>();
      
      allIdeas.forEach(idea => {
        const pName = idea.project || "Geral";
        projectMap.set(pName, (projectMap.get(pName) || 0) + 1);
      });

      const uniqueProjects = Array.from(projectMap.entries()).map(([name, count]) => ({
        name,
        ideaCount: count
      })).sort((a, b) => b.ideaCount - a.ideaCount); // Ordena pelos que tem mais ideias primeiro

      setProjects(uniqueProjects);
      setLoading(false);
    });
    
    return () => unsub();
  }, []);

  return (
    <div className="p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
      <header className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Projetos Trivium</h1>
        <p className="text-white/50">Todos os projetos que possuem ideias ativas.</p>
      </header>
      
      {loading ? (
         <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
         </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] glass rounded-3xl border border-dashed border-white/20">
          <Folder size={48} className="text-white/20 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum projeto ativo</h3>
          <p className="text-white/40 max-w-md text-center">Os projetos aparecerão aqui automaticamente quando você vincular uma ideia a eles no Dashboard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {projects.map(proj => (
            <Link href="/" key={proj.name} className="glass rounded-2xl p-6 flex flex-col group relative overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Folder size={24} />
              </div>
              
              <h3 className="text-xl font-bold mb-2 truncate" title={proj.name}>{proj.name}</h3>
              
              <div className="flex items-center gap-2 mt-auto text-white/50 text-sm font-medium">
                <Lightbulb size={16} className="text-yellow-500/80" />
                {proj.ideaCount} {proj.ideaCount === 1 ? 'ideia' : 'ideias'} vinculadas
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
