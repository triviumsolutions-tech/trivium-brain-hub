"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Folder,
  Loader2,
  Lightbulb,
  Kanban,
  Clock,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Idea, Project, ProjectStatus } from "@/types";

interface EnrichedProject {
  name: string;
  status: ProjectStatus;
  department?: string;
  painPoint?: string;
  ideaCount: number;
  taskCount: number;
}

const STATUS_ICONS: Record<ProjectStatus, LucideIcon> = {
  Backlog: Clock,
  Desenvolvimento: PlayCircle,
  Pausado: PauseCircle,
  Finalizado: CheckCircle2,
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Backlog: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Desenvolvimento: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Finalizado: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export default function ProjetosPage() {
  const [projects, setProjects] = useState<EnrichedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // 1. Escuta Projetos
    const projQuery = query(collection(db, "projects"));
    const unsubProj = onSnapshot(projQuery, (projSnap) => {
      const explicitProjects = projSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Project[];

      // 2. Escuta Ideias para agrupar contagens
      const ideaQuery = query(collection(db, "ideas"));
      const unsubIdeas = onSnapshot(ideaQuery, (ideaSnap) => {
        const allIdeas = ideaSnap.docs.map((d) => d.data() as Idea);

        const projectMap = new Map<string, EnrichedProject>();

        // Insere projetos explícitos
        explicitProjects.forEach((p) => {
          const rawName = (p.name || p.id || "").trim();
          if (!rawName) return;
          const key = rawName.toLowerCase();

          if (!projectMap.has(key)) {
            projectMap.set(key, {
              name: rawName,
              status: p.status || "Backlog",
              department: p.department,
              painPoint: p.painPoint,
              ideaCount: 0,
              taskCount: p.tasks?.length || 0,
            });
          }
        });

        // Contabiliza ideias vinculadas e insere projetos implícitos
        allIdeas.forEach((idea) => {
          const rawName = (idea.project || "").trim();
          if (
            !rawName ||
            rawName.toLowerCase() === "caixa de entrada" ||
            rawName.toLowerCase() === "geral" ||
            rawName.toLowerCase() === "brainstorm"
          ) {
            return;
          }
          const key = rawName.toLowerCase();

          const existing = projectMap.get(key);
          if (existing) {
            existing.ideaCount += 1;
          } else {
            projectMap.set(key, {
              name: rawName,
              status: "Backlog",
              department: idea.department,
              ideaCount: 1,
              taskCount: 0,
            });
          }
        });

        const list = Array.from(projectMap.values()).sort(
          (a, b) => b.ideaCount + b.taskCount - (a.ideaCount + a.taskCount)
        );

        setProjects(list);
        setLoading(false);
      });

      unsubs.push(unsubIdeas);
    });

    unsubs.push(unsubProj);
    return () => unsubs.forEach((u) => u());
  }, []);

  return (
    <div className="p-8 md:p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
      <header className="flex justify-between items-end mb-10 pb-6 border-b border-white/10">
        <div>
          <span className="text-xs uppercase font-mono px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 mb-2 inline-block">
            Esteira de Execução
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Projetos & Kanbans</h1>
          <p className="text-white/50 text-sm mt-1">
            Transição do abstrato para o executável com checkpoints e controle de esteira.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] glass rounded-3xl border border-dashed border-white/20 p-8 text-center">
          <Folder size={48} className="text-white/20 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum projeto ativo</h3>
          <p className="text-white/40 max-w-md text-xs leading-relaxed">
            Promova uma ideia aprovada no Hub através do Checkpoint de Promoção para iniciar um Projeto com Kanban.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj, idx) => {
            const StatusIcon = STATUS_ICONS[proj.status] || Clock;
            const statusClass = STATUS_COLORS[proj.status] || "bg-white/10 text-white/70";

            return (
              <Link
                href={`/projetos/${encodeURIComponent(proj.name)}`}
                key={`${proj.name}-${idx}`}
                className="glass rounded-2xl p-6 flex flex-col group relative overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                    <Folder size={20} />
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusClass}`}
                  >
                    <StatusIcon size={12} />
                    {proj.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold mb-1 truncate text-white group-hover:text-purple-300 transition-colors relative z-10" title={proj.name}>
                  {proj.name}
                </h3>

                {proj.department && (
                  <span className="text-[11px] text-white/40 mb-3 relative z-10 block">
                    #{proj.department}
                  </span>
                )}

                {proj.painPoint && (
                  <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-4 relative z-10">
                    {proj.painPoint}
                  </p>
                )}

                <div className="flex items-center gap-4 mt-auto pt-3 border-t border-white/5 text-white/50 text-xs font-medium relative z-10">
                  <div className="flex items-center gap-1.5">
                    <Kanban size={14} className="text-blue-400" />
                    <span>{proj.taskCount} {proj.taskCount === 1 ? "tarefa" : "tarefas"}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Lightbulb size={14} className="text-yellow-400" />
                    <span>{proj.ideaCount} {proj.ideaCount === 1 ? "ideia" : "ideias"}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
