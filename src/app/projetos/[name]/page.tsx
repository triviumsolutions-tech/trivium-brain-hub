"use client";

import { useEffect, useState, use, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
import {
  ArrowLeft,
  Loader2,
  Folder,
  X,
  PenTool,
  PlusCircle,
  Sparkles,
  Lock,
  Kanban,
  Lightbulb,
  CheckCircle2,
  Clock,
  PlayCircle,
  PauseCircle,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  Trash2,
  AlertCircle,
  LucideIcon,
  ChevronDown,
  Check,
  Calendar,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Whiteboard } from "@/components/Whiteboard";
import { NewIdeaModal } from "@/components/NewIdeaModal";
import { ScheduleMeetingModal } from "@/components/ScheduleMeetingModal";
import { Idea, Project, ProjectStatus, KanbanTask } from "@/types";

const PROJECT_STATUSES: { label: ProjectStatus; color: string; icon: LucideIcon }[] = [
  { label: "Backlog", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Clock },
  { label: "Desenvolvimento", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: PlayCircle },
  { label: "Pausado", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: PauseCircle },
  { label: "Finalizado", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
];

export default function ProjetoDetalhePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const resolvedParams = use(params);
  const projectName = decodeURIComponent(resolvedParams.name);

  // Estados do Projeto e Ideias
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);

  // Visualização ativa: Kanban ou Ideias
  const [viewMode, setViewMode] = useState<"kanban" | "ideas">("kanban");

  // Kanban Tasks
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAnalyzingWhiteboard, setIsAnalyzingWhiteboard] = useState(false);

  // Whiteboard Modal
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [projectDrawing, setProjectDrawing] = useState("");
  const [isSavingDrawing, setIsSavingDrawing] = useState(false);
  const [drawingLoaded, setDrawingLoaded] = useState(false);

  // Modal Ideia
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [isNewIdeaModalOpen, setIsNewIdeaModalOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [syncingJiraId, setSyncingJiraId] = useState<string | null>(null);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // 1. Escuta Projeto no Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "projects", projectName), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Project;
        setProjectData(data);
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks);
        }
        if (data.drawing) {
          setProjectDrawing(data.drawing);
          setDrawingLoaded(true);
        }
      } else {
        // Se ainda não existia explicitamente, inicializa
        const defaultProj: Project = {
          name: projectName,
          status: "Backlog",
          tasks: [],
        };
        setProjectData(defaultProj);
      }
    });

    return () => unsub();
  }, [projectName]);

  // 2. Escuta Ideias vinculadas
  useEffect(() => {
    const q = query(collection(db, "ideas"), where("project", "==", projectName));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Idea[];
      setIdeas(fetched);
    });

    return () => unsub();
  }, [projectName]);

  // Atualiza status do Projeto (Máquina de Estados)
  const handleUpdateProjectStatus = async (newStatus: ProjectStatus) => {
    try {
      await setDoc(
        doc(db, "projects", projectName),
        { status: newStatus },
        { merge: true }
      );
      await logAuditEvent("PROJECT_STATUS_CHANGED", projectName, `Status: ${newStatus}`);
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar status do projeto.");
    }
  };

  // Salva Whiteboard
  const saveProjectCanvas = async (dataToSave: string) => {
    setIsSavingDrawing(true);
    try {
      await setDoc(
        doc(db, "projects", projectName),
        { drawing: dataToSave },
        { merge: true }
      );
      await logAuditEvent("WHITEBOARD_SAVED", projectName);
      setShowWhiteboard(false);
    } catch (e) {
      console.error("Erro ao salvar desenho do projeto:", e);
      alert("Erro ao salvar o Quadro do Projeto.");
    } finally {
      setIsSavingDrawing(false);
    }
  };

  // Ações do Kanban
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: KanbanTask = {
      id: `${Date.now()}-${Math.random()}`,
      title: newTaskTitle.trim(),
      status: "Backlog",
      priority: "media",
      createdAt: new Date().toISOString(),
    };

    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    setNewTaskTitle("");
    setIsAddingTask(false);

    await setDoc(doc(db, "projects", projectName), { tasks: updatedTasks }, { merge: true });
    await logAuditEvent("KANBAN_TASK_CREATED", projectName, newTask.title);
  };

  const handleMoveTask = async (taskId: string, targetStatus: ProjectStatus) => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t));
    setTasks(updated);
    await setDoc(doc(db, "projects", projectName), { tasks: updated }, { merge: true });
  };

  const handleDeleteTask = async (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    await setDoc(doc(db, "projects", projectName), { tasks: updated }, { merge: true });
  };

  // Extração Tática via IA do Whiteboard ➔ Kanban
  const handleAnalyzeWhiteboard = async () => {
    if (!projectDrawing) {
      alert("O quadro branco do projeto ainda está vazio! Desenhe wireframes ou arquiteturas primeiro.");
      return;
    }

    setIsAnalyzingWhiteboard(true);
    try {
      const res = await fetch("/api/analyze-whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          projectDescription: projectData?.painPoint || "Projeto Trivium",
          whiteboardData: projectDrawing,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const generatedTasks: KanbanTask[] = (data.tasks || []).map(
        (t: {
          title: string;
          description?: string;
          priority?: "alta" | "media" | "baixa";
        }) => ({
          id: `${Date.now()}-${Math.random()}`,
          title: t.title,
          description: t.description,
          status: "Backlog",
          priority: t.priority || "alta",
          createdAt: new Date().toISOString(),
        })
      );

      const updated = [...tasks, ...generatedTasks];
      setTasks(updated);
      await setDoc(doc(db, "projects", projectName), { tasks: updated }, { merge: true });
      await logAuditEvent("AI_WHITEBOARD_EXTRACTION", projectName, `${generatedTasks.length} tarefas criadas`);

      alert(`Sucesso! A IA analisou o quadro branco e derivou ${generatedTasks.length} tarefas táticas no Backlog.`);
    } catch (err: unknown) {
      console.error(err);
      alert("Erro ao extrair tarefas da lousa: " + (err as Error).message);
    } finally {
      setIsAnalyzingWhiteboard(false);
    }
  };

  // Integração com Jira Board KAN
  const handleSendToJira = async (task: KanbanTask) => {
    setSyncingJiraId(task.id);
    try {
      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_issue",
          taskTitle: `[${projectName}] ${task.title}`,
          taskDescription: task.description || "",
        }),
      });
      const data = await res.json();
      if (data.key) {
        const updatedTasks = tasks.map((t) =>
          t.id === task.id ? { ...t, jiraKey: data.key, jiraUrl: data.url } : t
        );
        setTasks(updatedTasks);
        await setDoc(doc(db, "projects", projectName), { tasks: updatedTasks }, { merge: true });
        await logAuditEvent("TASK_SENT_TO_JIRA", task.title, `Ticket: ${data.key}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o Jira.");
    } finally {
      setSyncingJiraId(null);
    }
  };

  const currentProjectStatus = projectData?.status || "Backlog";
  const isProjectFrozen = currentProjectStatus === "Finalizado";

  return (
    <>
      <NewIdeaModal
        isOpen={isNewIdeaModalOpen}
        onClose={() => setIsNewIdeaModalOpen(false)}
        defaultProject={projectName}
      />

      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        defaultProject={projectName}
        defaultTitle={`Alinhamento • Projeto ${projectName}`}
      />

      {/* Modal Tela Cheia do Quadro Branco */}
      {showWhiteboard && mounted && createPortal(
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
          <header className="px-6 py-4 flex justify-between items-center bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white">
                <PenTool size={16} />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                  Quadro Branco: {projectName}
                  {isProjectFrozen && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Lock size={11} /> Congelado
                    </span>
                  )}
                </h3>
                <p className="text-xs text-white/50">
                  {isProjectFrozen
                    ? "Projeto Finalizado. O quadro tornou-se documentação técnica histórica permanente."
                    : "Desenhe mapas mentais, wireframes e arquiteturas técnicas para este projeto."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowWhiteboard(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium transition-colors"
              >
                {isProjectFrozen ? "Fechar" : "Cancelar"}
              </button>

              {!isProjectFrozen && (
                <button
                  onClick={() => saveProjectCanvas(projectDrawing)}
                  disabled={isSavingDrawing}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                >
                  {isSavingDrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Quadro"}
                </button>
              )}
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
                readOnly={isProjectFrozen}
              />
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Conteúdo Principal da Página do Projeto */}
      <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
        <Link
          href="/projetos"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 text-xs font-medium w-fit"
        >
          <ArrowLeft size={14} /> Voltar para Todos os Projetos
        </Link>

        {/* Top Header do Projeto com Máquina de Estados */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 pb-8 border-b border-white/10">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Folder size={18} />
              </div>

              <h1 className="text-3xl md:text-4xl font-bold">{projectName}</h1>

              {/* Seletor Customizado do Status do Projeto */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-full border flex items-center gap-2 transition-all backdrop-blur-md shadow-lg ${
                    PROJECT_STATUSES.find((s) => s.label === currentProjectStatus)?.color || "border-white/10 text-white"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  <span>{currentProjectStatus}</span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isStatusDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 z-50 min-w-48 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                    {PROJECT_STATUSES.map((st) => (
                      <button
                        key={st.label}
                        type="button"
                        onClick={() => {
                          handleUpdateProjectStatus(st.label);
                          setIsStatusDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          currentProjectStatus === st.label
                            ? "bg-white/15 text-white"
                            : "text-white/70 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${st.color.split(" ")[1] || "bg-purple-400"}`} />
                          <span>{st.label}</span>
                        </span>
                        {currentProjectStatus === st.label && <Check size={14} className="text-purple-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {projectData?.department && (
                <span className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                  #{projectData.department}
                </span>
              )}
            </div>

            {/* Rastreabilidade de Origem e Dor */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/50 mt-3">
              {projectData?.origin_idea_id && (
                <span className="flex items-center gap-1.5 text-purple-300 font-mono">
                  <Lightbulb size={13} /> Semente Original: ID {projectData.origin_idea_id.slice(0, 8)}...
                </span>
              )}
              {projectData?.painPoint && (
                <span className="flex items-center gap-1.5 text-red-300">
                  <AlertCircle size={13} /> Dor: {projectData.painPoint}
                </span>
              )}
            </div>
          </div>

          {/* Ações do Projeto */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowWhiteboard(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all"
            >
              <PenTool size={14} />
              <span>{isProjectFrozen ? "Ver Lousa Histórica" : "Lousa do Projeto"}</span>
              {isProjectFrozen && <Lock size={12} className="text-amber-400 ml-1" />}
            </button>

            <button
              onClick={handleAnalyzeWhiteboard}
              disabled={isAnalyzingWhiteboard}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium flex items-center gap-2 border border-white/10 transition-colors disabled:opacity-50"
              title="A IA analisa os traços da lousa e adiciona tarefas direto no Kanban"
            >
              {isAnalyzingWhiteboard ? (
                <Loader2 size={14} className="animate-spin text-purple-400" />
              ) : (
                <Sparkles size={14} className="text-purple-400" />
              )}
              <span>IA: Extrair da Lousa</span>
            </button>

            {/* Link oficial do Jira Board KAN */}
            <a
              href="https://triviumsolutions.atlassian.net/jira/software/projects/KAN/boards/1?filter=&groupBy=none"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-blue-500/30 transition-colors"
              title="Abrir quadro KAN oficial no Jira Atlassian"
            >
              <ExternalLink size={13} />
              <span>Jira (KAN)</span>
            </a>

            {/* Agendar Reunião de Equipe */}
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30 transition-colors"
              title="Agendar alinhamento de sprint ou entrega no Google Agenda"
            >
              <Calendar size={13} />
              <span>Agendar Reunião</span>
            </button>
          </div>
        </header>

        {/* Abas: Kanban vs Ideias */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl text-xs">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "kanban" ? "bg-white/15 text-white shadow" : "text-white/50 hover:text-white"
              }`}
            >
              <Kanban size={14} />
              <span>Quadro Kanban ({tasks.length})</span>
            </button>

            <button
              onClick={() => setViewMode("ideas")}
              className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "ideas" ? "bg-white/15 text-white shadow" : "text-white/50 hover:text-white"
              }`}
            >
              <Lightbulb size={14} />
              <span>Ideias Vinculadas ({ideas.length})</span>
            </button>
          </div>

          {viewMode === "kanban" && (
            <button
              onClick={() => setIsAddingTask(true)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 border border-white/10 transition-colors"
            >
              <PlusCircle size={14} /> Adicionar Tarefa
            </button>
          )}

          {viewMode === "ideas" && (
            <button
              onClick={() => setIsNewIdeaModalOpen(true)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 border border-white/10 transition-colors"
            >
              <PlusCircle size={14} /> Nova Ideia
            </button>
          )}
        </div>

        {/* Modal Rápido de Criação de Tarefa do Kanban */}
        {isAddingTask && (
          <form
            onSubmit={handleAddTask}
            className="mb-6 p-4 glass rounded-2xl border border-purple-500/30 flex items-center gap-3 animate-in fade-in"
          >
            <input
              type="text"
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Nome da nova tarefa técnica do Kanban..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
            <button
              type="button"
              onClick={() => setIsAddingTask(false)}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
            >
              Adicionar ao Backlog
            </button>
          </form>
        )}

        {/* MODO 1: QUADRO KANBAN OFICIAL */}
        {viewMode === "kanban" && (
          <div className="flex flex-col flex-1">
            <div className="md:hidden flex items-center justify-between text-[11px] text-white/40 mb-2 px-1">
              <span>👉 Deslize para ver todas as colunas</span>
              <span className="font-mono text-purple-400">4 colunas</span>
            </div>

            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-6 snap-x snap-mandatory flex-1 -mx-4 px-4 md:mx-0 md:px-0">
              {PROJECT_STATUSES.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col.label);
                const ColIcon = col.icon;

                return (
                  <div
                    key={col.label}
                    className="w-[82vw] sm:w-[320px] md:w-auto shrink-0 md:shrink glass rounded-2xl p-4 flex flex-col min-h-[480px] border border-white/5 snap-center"
                  >
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <ColIcon size={14} className="text-white/60" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                        {col.label}
                      </h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-semibold">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {colTasks.length === 0 ? (
                      <div className="h-32 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-white/30">
                        Vazio
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3.5 bg-neutral-900/80 rounded-xl border border-white/10 hover:border-purple-500/40 transition-colors shadow group"
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h4 className="text-xs font-semibold text-white leading-tight">
                              {task.title}
                            </h4>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity p-1"
                              title="Remover"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-white/50 mb-3 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                          {/* Badge / Ação Jira KAN */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            {task.jiraKey ? (
                              <a
                                href={task.jiraUrl || `https://triviumsolutions.atlassian.net/browse/${task.jiraKey}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-bold hover:bg-blue-500/30 transition-colors"
                                title="Abrir ticket no Jira KAN"
                              >
                                <span>{task.jiraKey}</span>
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendToJira(task)}
                                disabled={syncingJiraId === task.id}
                                className="inline-flex items-center gap-1 text-[10px] text-blue-400/80 hover:text-blue-300 transition-colors font-medium bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20"
                                title="Vincular e enviar para o Jira KAN"
                              >
                                {syncingJiraId === task.id ? (
                                  <Loader2 size={10} className="animate-spin text-blue-400" />
                                ) : (
                                  <>
                                    <span>+ Jira KAN</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Botões para Mover Tarefa entre Colunas */}
                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/40">
                            {col.label !== "Backlog" && (
                              <button
                                onClick={() => {
                                  const idx = PROJECT_STATUSES.findIndex((s) => s.label === col.label);
                                  handleMoveTask(task.id, PROJECT_STATUSES[idx - 1].label);
                                }}
                                className="hover:text-white flex items-center gap-1 transition-colors"
                                title="Mover para coluna anterior"
                              >
                                <ArrowLeftIcon size={11} /> Anterior
                              </button>
                            )}

                            {col.label !== "Finalizado" && (
                              <button
                                onClick={() => {
                                  const idx = PROJECT_STATUSES.findIndex((s) => s.label === col.label);
                                  handleMoveTask(task.id, PROJECT_STATUSES[idx + 1].label);
                                }}
                                className="hover:text-purple-300 ml-auto flex items-center gap-1 transition-colors font-medium text-purple-400"
                                title="Avançar coluna"
                              >
                                Avançar <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

        {/* MODO 2: LISTA DE IDEIAS VINCULADAS */}
        {viewMode === "ideas" && (
          <div>
            {ideas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[35vh] glass rounded-3xl border border-dashed border-white/20 p-8 text-center">
                <Lightbulb size={40} className="text-white/20 mb-3" />
                <h3 className="text-lg font-semibold mb-1 text-white">Nenhuma ideia vinculada ainda</h3>
                <p className="text-xs text-white/40">
                  Adicione ideias diretamente a este projeto ou promova uma ideia do Hub.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ideas.map((idea) => (
                  <div
                    key={idea.id}
                    onClick={() => setSelectedIdea(idea)}
                    className="glass glass-hover rounded-2xl p-6 flex flex-col group cursor-pointer border border-white/5"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/70">
                        {idea.status}
                      </span>
                      {idea.department && (
                        <span className="text-xs text-purple-300 font-medium">#{idea.department}</span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{idea.title}</h3>
                    <p className="text-xs text-white/50 line-clamp-3 leading-relaxed mb-4">
                      {idea.desc}
                    </p>
                    <span className="text-xs text-purple-400 font-medium mt-auto flex items-center gap-1">
                      Ver discussão <ArrowRight size={12} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal da Ideia Individual */}
      {selectedIdea && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="glass w-full max-w-3xl rounded-3xl p-6 md:p-8 relative border border-white/15 shadow-2xl">
            <button
              onClick={() => setSelectedIdea(null)}
              className="absolute top-6 right-6 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10"
            >
              <X size={18} />
            </button>

            <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-3 inline-block">
              {selectedIdea.project}
            </span>

            <h2 className="text-2xl font-bold mb-4 text-white">{selectedIdea.title}</h2>

            <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 text-xs text-white/80">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 leading-relaxed whitespace-pre-wrap">
                {selectedIdea.desc}
              </div>
              {selectedIdea.notes && (
                <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                  <h4 className="font-bold uppercase text-purple-300 mb-1">Notas & Discussão</h4>
                  <p className="whitespace-pre-wrap">{selectedIdea.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
