"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
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
  Trash2,
  Plus,
  X,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Idea, Project, ProjectStatus, DepartmentTag } from "@/types";

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

const DEPARTMENTS: DepartmentTag[] = [
  "Produto",
  "Engenharia",
  "Design",
  "Marketing",
  "Vendas",
  "Operações",
  "Geral",
];

export default function ProjetosPage() {
  const [projects, setProjects] = useState<EnrichedProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Exclusão de Projeto
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados de Criação de Projeto
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectStatus, setNewProjectStatus] = useState<ProjectStatus>("Desenvolvimento");
  const [newProjectDepartment, setNewProjectDepartment] = useState<DepartmentTag>("Produto");
  const [newProjectPainPoint, setNewProjectPainPoint] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

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

  // Exclui projeto e desvincula ideias com segurança
  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);

    try {
      // 1. Remove documento do projeto na coleção 'projects'
      await deleteDoc(doc(db, "projects", projectToDelete));

      // 2. Busca e desvincula quaisquer ideias associadas
      const ideaQuery = query(collection(db, "ideas"), where("project", "==", projectToDelete));
      const snap = await getDocs(ideaQuery);
      for (const d of snap.docs) {
        await updateDoc(doc(db, "ideas", d.id), {
          project: "Caixa de Entrada",
          status: "Rascunho",
        });
      }

      await logAuditEvent("PROJECT_DELETED", projectToDelete, "Excluído pelo usuário via interface");
      setProjectToDelete(null);
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      alert("Não foi possível excluir o projeto.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Criação de Novo Projeto com validação
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newProjectName.trim();
    if (!cleanName) {
      alert("O nome do projeto é obrigatório.");
      return;
    }

    setIsCreatingProject(true);
    try {
      await setDoc(
        doc(db, "projects", cleanName),
        {
          name: cleanName,
          status: newProjectStatus,
          department: newProjectDepartment,
          painPoint: newProjectPainPoint.trim(),
          createdAt: new Date().toISOString(),
          tasks: [],
        },
        { merge: true }
      );

      await logAuditEvent("PROJECT_CREATED", cleanName, `Departamento: ${newProjectDepartment}`);
      setIsNewProjectModalOpen(false);
      setNewProjectName("");
      setNewProjectPainPoint("");
    } catch (err) {
      console.error("Erro ao criar projeto:", err);
      alert("Não foi possível criar o projeto.");
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10 pb-6 border-b border-white/10">
        <div>
          <span className="text-xs uppercase font-mono px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 mb-2 inline-block">
            Esteira de Execução
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Projetos & Kanbans</h1>
          <p className="text-white/50 text-sm mt-1">
            Transição do abstrato para o executável com checkpoints e controle de esteira.
          </p>
        </div>

        <button
          onClick={() => setIsNewProjectModalOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.35)] transition-all shrink-0"
        >
          <Plus size={16} />
          <span>Novo Projeto</span>
        </button>
      </header>

      {/* Modal de Confirmação de Exclusão */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass max-w-md w-full rounded-3xl p-6 border border-red-500/30 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/30">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">Excluir Projeto</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              Tem certeza que deseja excluir o projeto{" "}
              <strong className="text-white">&quot;{projectToDelete}&quot;</strong>?
            </p>
            <p className="text-xs text-white/50 mb-6 bg-white/5 p-3 rounded-xl border border-white/10">
              ℹ️ As ideias associadas a este projeto serão desvinculadas e movidas de volta para a
              Caixa de Entrada.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/40 flex items-center gap-2 transition-all"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isDeleting ? "Excluindo..." : "Confirmar e Excluir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Novo Projeto */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="glass max-w-lg w-full rounded-3xl p-6 border border-white/15 shadow-2xl relative">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Folder size={18} />
                </div>
                <h3 className="text-lg font-bold text-white">Criar Novo Projeto</h3>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1.5">
                  Nome do Projeto (kebab-case ou Nome Oficial) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: trivium-cooking-calculator"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/70 block mb-1.5">
                    Departamento
                  </label>
                  <select
                    value={newProjectDepartment}
                    onChange={(e) => setNewProjectDepartment(e.target.value as DepartmentTag)}
                    className="w-full bg-neutral-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/70 block mb-1.5">
                    Status Inicial
                  </label>
                  <select
                    value={newProjectStatus}
                    onChange={(e) => setNewProjectStatus(e.target.value as ProjectStatus)}
                    className="w-full bg-neutral-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="Desenvolvimento">Desenvolvimento</option>
                    <option value="Backlog">Backlog</option>
                    <option value="Pausado">Pausado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1.5">
                  Dor Resolvida / Problema de Negócio
                </label>
                <textarea
                  rows={3}
                  placeholder="Qual o problema ou oportunidade central que este projeto resolve?"
                  value={newProjectPainPoint}
                  onChange={(e) => setNewProjectPainPoint(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  disabled={isCreatingProject}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProject}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 flex items-center gap-2 transition-all"
                >
                  {isCreatingProject ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>{isCreatingProject ? "Criando..." : "Criar Projeto"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] glass rounded-3xl border border-dashed border-white/20 p-8 text-center">
          <Folder size={48} className="text-white/20 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum projeto ativo</h3>
          <p className="text-white/40 max-w-md text-xs leading-relaxed">
            Clique em &quot;Novo Projeto&quot; ou promova uma ideia aprovada no Hub através do Checkpoint de Promoção.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj, idx) => {
            const StatusIcon = STATUS_ICONS[proj.status] || Clock;
            const statusClass = STATUS_COLORS[proj.status] || "bg-white/10 text-white/70";

            return (
              <div
                key={`${proj.name}-${idx}`}
                className="glass rounded-2xl p-6 flex flex-col group relative overflow-hidden hover:-translate-y-1 transition-all duration-300 border border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start mb-4 relative z-10">
                  <Link
                    href={`/projetos/${encodeURIComponent(proj.name)}`}
                    className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform"
                  >
                    <Folder size={20} />
                  </Link>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusClass}`}
                    >
                      <StatusIcon size={12} />
                      {proj.status}
                    </span>

                    {/* Botão de Excluir Projeto */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProjectToDelete(proj.name);
                      }}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-300 border border-transparent hover:border-red-500/30 flex items-center justify-center transition-all"
                      title="Excluir Projeto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <Link
                  href={`/projetos/${encodeURIComponent(proj.name)}`}
                  className="block relative z-10"
                >
                  <h3
                    className="text-lg font-bold mb-1 truncate text-white group-hover:text-purple-300 transition-colors"
                    title={proj.name}
                  >
                    {proj.name}
                  </h3>

                  {proj.department && (
                    <span className="text-[11px] text-white/40 mb-3 block">
                      #{proj.department}
                    </span>
                  )}

                  {proj.painPoint && (
                    <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-4">
                      {proj.painPoint}
                    </p>
                  )}
                </Link>

                <div className="flex items-center gap-4 mt-auto pt-3 border-t border-white/5 text-white/50 text-xs font-medium relative z-10">
                  <div className="flex items-center gap-1.5">
                    <Kanban size={14} className="text-blue-400" />
                    <span>
                      {proj.taskCount} {proj.taskCount === 1 ? "tarefa" : "tarefas"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Lightbulb size={14} className="text-yellow-400" />
                    <span>
                      {proj.ideaCount} {proj.ideaCount === 1 ? "ideia" : "ideias"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
