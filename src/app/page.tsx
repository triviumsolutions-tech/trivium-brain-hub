"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { UploadModal } from "@/components/UploadModal";
import { QuickAddModal } from "@/components/QuickAddModal";
import { NewIdeaModal } from "@/components/NewIdeaModal";
import { ScheduleMeetingModal } from "@/components/ScheduleMeetingModal";
import {
  Search,
  X,
  Folder,
  Loader2,
  PlusCircle,
  Zap,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Rocket,
  AlertCircle,
  ArrowRight,
  Inbox,
  Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
import { Idea, IdeaStatus, DepartmentTag } from "@/types";

const DEPARTMENTS: DepartmentTag[] = [
  "Engenharia",
  "Marketing",
  "Produto",
  "Design",
  "Vendas",
  "Operações",
  "Geral",
];

const STATUS_OPTIONS: { label: IdeaStatus; color: string }[] = [
  { label: "Rascunho", color: "bg-slate-500" },
  { label: "Em Refinamento", color: "bg-blue-500" },
  { label: "Aprovada", color: "bg-emerald-500" },
  { label: "Estacionada", color: "bg-amber-500" },
  { label: "Sugestão da IA", color: "bg-purple-500" },
];

export default function Home() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "quarantine" | "inbox" | "approved">("all");
  const [loadingDb, setLoadingDb] = useState(true);

  // Modais
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isNewIdeaModalOpen, setIsNewIdeaModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTargetTitle, setScheduleTargetTitle] = useState("");
  const [scheduleTargetProject, setScheduleTargetProject] = useState("");
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);

  // Edição no Modal da Ideia
  const [editNotes, setEditNotes] = useState("");
  const [editPainPoint, setEditPainPoint] = useState("");
  const [editDepartment, setEditDepartment] = useState<DepartmentTag>("Geral");
  const [editStatus, setEditStatus] = useState<IdeaStatus>("Rascunho");
  const [isSaving, setIsSaving] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionError, setPromotionError] = useState("");

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Atalho global "Q" para Quick Add
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Busca em tempo real das Ideias
  useEffect(() => {
    const q = query(collection(db, "ideas"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const fetchedIdeas = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Idea[];
        setIdeas(fetchedIdeas);
        setLoadingDb(false);
      },
      (error) => {
        console.error("Erro ao buscar ideias:", error);
        setLoadingDb(false);
      }
    );

    return () => unsub();
  }, []);

  // Lista de projetos únicos existentes
  const existingProjects = Array.from(
    new Set(
      ideas
        .map((i) => i.project)
        .filter((p) => p && p !== "Caixa de Entrada" && p !== "Geral")
    )
  );

  // Ingestão via IA: Salva a Ata e coloca sugestões em Quarentena
  const handleUploadSuccess = async ({
    meetingMinutes,
    suggestions,
  }: {
    meetingMinutes?: string;
    suggestions: Partial<Idea>[];
  }) => {
    try {
      // 1. Salva a Ata Histórica da Reunião
      if (meetingMinutes) {
        await addDoc(collection(db, "meetings"), {
          title: `Reunião ${new Date().toLocaleDateString("pt-BR")}`,
          meetingMinutes,
          actionItems: suggestions.flatMap((s) => s.actionItems || []),
          relatedProject: suggestions[0]?.project || "Geral",
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Salva as Sugestões com regra de Quarentena (isQuarantined: true)
      for (const s of suggestions) {
        await addDoc(collection(db, "ideas"), {
          title: s.title || "Sugestão sem título",
          project: s.project || "Brainstorm",
          status: "Sugestão da IA",
          statusColor: "bg-purple-500",
          desc: s.desc || "Sugestão extraída via IA.",
          painPoint: s.painPoint || "",
          department: s.department || "Geral",
          actionItems: s.actionItems || [],
          isQuarantined: true,
          createdAt: new Date().toISOString(),
        });
      }

      await logAuditEvent("AI_MEETING_INGESTION", "meetings", `${suggestions.length} sugestões em quarentena`);
      setActiveTab("quarantine");
      alert(`Transcrição concluída! ${suggestions.length} sugestões adicionadas à Quarentena.`);
    } catch (e: unknown) {
      console.error("Erro salvando ideias extraídas", e);
      alert("Erro ao salvar no banco: " + (e as Error).message);
    }
  };

  // Ações de Triagem da Quarentena (Human-in-the-loop)
  const handleApproveQuarantined = async (idea: Idea, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!idea.id) return;
    try {
      await updateDoc(doc(db, "ideas", idea.id), {
        isQuarantined: false,
        status: "Aprovada",
        statusColor: "bg-emerald-500",
      });
      await logAuditEvent("QUARANTINE_APPROVED", idea.id, `Aprovada: ${idea.title}`);
    } catch (err) {
      console.error(err);
      alert("Erro ao aprovar sugestão.");
    }
  };

  const handleDiscardQuarantined = async (idea: Idea, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!idea.id) return;
    if (!confirm(`Deseja descartar a sugestão "${idea.title}"?`)) return;
    try {
      await deleteDoc(doc(db, "ideas", idea.id));
      await logAuditEvent("QUARANTINE_DISCARDED", idea.id, `Descartada: ${idea.title}`);
    } catch (err) {
      console.error(err);
      alert("Erro ao descartar sugestão.");
    }
  };

  // Abre Modal de Detalhes da Ideia
  const openIdea = (idea: Idea) => {
    setSelectedIdea(idea);
    setEditNotes(idea.notes || "");
    setEditPainPoint(idea.painPoint || "");
    setEditDepartment(idea.department || "Geral");
    setEditStatus(idea.status || "Rascunho");
    setPromotionError("");
  };

  // Salva Edição da Ideia
  const saveIdeaDetails = async () => {
    if (!selectedIdea?.id) return;
    setIsSaving(true);
    try {
      const statusColor =
        STATUS_OPTIONS.find((s) => s.label === editStatus)?.color || "bg-purple-500";

      await updateDoc(doc(db, "ideas", selectedIdea.id), {
        notes: editNotes,
        painPoint: editPainPoint,
        department: editDepartment,
        status: editStatus,
        statusColor,
        isQuarantined: false,
      });

      await logAuditEvent("IDEA_UPDATED", selectedIdea.id, `Status: ${editStatus}`);
      setSelectedIdea(null);
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao salvar alterações da Ideia.");
    } finally {
      setIsSaving(false);
    }
  };

  // Checkpoint de Promoção: Converte Ideia em Projeto Oficial
  const handlePromoteToProject = async () => {
    if (!selectedIdea?.id) return;

    // Validação do Checkpoint rigoroso
    if (!editPainPoint.trim()) {
      setPromotionError("Obrigatório: Defina claramente a Dor / Problema antes de promover a Projeto.");
      return;
    }
    if (!editDepartment || editDepartment === "Geral") {
      setPromotionError("Obrigatório: Atribua uma tag de departamento específica (ex: Engenharia, Marketing, Produto).");
      return;
    }

    setIsPromoting(true);
    setPromotionError("");

    try {
      const projectName = selectedIdea.project && selectedIdea.project !== "Caixa de Entrada" && selectedIdea.project !== "Brainstorm"
        ? selectedIdea.project
        : selectedIdea.title;

      // Cria ou atualiza o projeto oficial na coleção 'projects'
      await setDoc(
        doc(db, "projects", projectName),
        {
          name: projectName,
          status: "Backlog",
          department: editDepartment,
          painPoint: editPainPoint,
          origin_idea_id: selectedIdea.id,
          createdAt: new Date().toISOString(),
          tasks: [
            {
              id: `${Date.now()}-1`,
              title: `Definir arquitetura e escopo: ${selectedIdea.title}`,
              description: editPainPoint,
              status: "Backlog",
              priority: "alta",
            },
          ],
        },
        { merge: true }
      );

      // Marca a Ideia como promovida e Aprovada
      await updateDoc(doc(db, "ideas", selectedIdea.id), {
        status: "Aprovada",
        statusColor: "bg-emerald-500",
        promotedToProject: projectName,
        painPoint: editPainPoint,
        department: editDepartment,
        isQuarantined: false,
      });

      await logAuditEvent("PROMOTED_TO_PROJECT", projectName, `Ideia de origem: ${selectedIdea.id}`);

      setSelectedIdea(null);
      router.push(`/projetos/${encodeURIComponent(projectName)}`);
    } catch (err: unknown) {
      console.error("Erro ao promover a projeto:", err);
      setPromotionError("Falha na promoção: " + (err as Error).message);
    } finally {
      setIsPromoting(false);
    }
  };

  // Contadores das abas
  const quarantinedCount = ideas.filter((i) => i.isQuarantined).length;
  const inboxCount = ideas.filter((i) => i.inbox || i.status === "Rascunho").length;
  const approvedCount = ideas.filter((i) => i.status === "Aprovada").length;

  // Filtragem conforme a aba selecionada e busca
  const filteredIdeas = ideas.filter((idea) => {
    const matchesSearch =
      idea.title?.toLowerCase().includes(search.toLowerCase()) ||
      idea.project?.toLowerCase().includes(search.toLowerCase()) ||
      idea.desc?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "quarantine") return idea.isQuarantined;
    if (activeTab === "inbox") return idea.inbox || idea.status === "Rascunho";
    if (activeTab === "approved") return idea.status === "Aprovada";
    return true;
  });

  return (
    <>
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        existingProjects={existingProjects}
      />

      <NewIdeaModal
        isOpen={isNewIdeaModalOpen}
        onClose={() => setIsNewIdeaModalOpen(false)}
      />

      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        defaultTitle={scheduleTargetTitle}
        defaultProject={scheduleTargetProject}
        existingProjects={existingProjects}
      />

      <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs uppercase font-mono px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                O Funil de Captura
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Hub de Ideias & Conhecimento</h1>
            <p className="text-white/50 text-sm mt-1">
              Do caos criativo à execução técnica estruturada no ecossistema Trivium.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Botão Quick Add Universal */}
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2"
              title="Atalho: Pressione 'Q'"
            >
              <Zap size={14} /> Quick Add <kbd className="bg-black/30 px-1.5 py-0.5 rounded text-[10px]">Q</kbd>
            </button>

            <button
              onClick={() => {
                setScheduleTargetTitle("Alinhamento Estratégico Trivium");
                setScheduleTargetProject("Geral");
                setIsScheduleModalOpen(true);
              }}
              className="px-4 py-2.5 bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
              title="Agendar reunião na Google Agenda e salvar no Hub"
            >
              <Calendar size={14} /> Agendar Reunião
            </button>

            <button
              onClick={() => setIsNewIdeaModalOpen(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 border border-white/10"
            >
              <PlusCircle size={15} /> Nova Ideia
            </button>
          </div>
        </header>

        {/* Upload de Gravação / Ouvido da Empresa */}
        <section className="mb-10">
          <UploadModal
            onUploadSuccess={handleUploadSuccess}
            existingProjects={existingProjects}
          />
        </section>

        {/* Barra de Filtros / Abas do Funil */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all ${
                activeTab === "all" ? "bg-white/15 text-white shadow" : "text-white/50 hover:text-white"
              }`}
            >
              Todas ({ideas.length})
            </button>

            <button
              onClick={() => setActiveTab("quarantine")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "quarantine"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <ShieldAlert size={13} className="text-amber-400" />
              <span>Quarentena IA</span>
              {quarantinedCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                  {quarantinedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("inbox")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "inbox" ? "bg-white/15 text-white shadow" : "text-white/50 hover:text-white"
              }`}
            >
              <Inbox size={13} />
              <span>Caixa de Entrada</span>
              {inboxCount > 0 && <span className="text-white/40 text-[11px]">({inboxCount})</span>}
            </button>

            <button
              onClick={() => setActiveTab("approved")}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "approved"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Aprovadas</span>
              {approvedCount > 0 && <span className="text-emerald-400/60 text-[11px]">({approvedCount})</span>}
            </button>
          </div>

          <div className="relative glass rounded-2xl px-4 py-2 flex items-center gap-2 w-full sm:w-72">
            <Search size={16} className="text-white/40" />
            <input
              type="text"
              placeholder="Buscar ideias ou projetos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-white placeholder:text-white/30 outline-none w-full"
            />
          </div>
        </div>

        {/* Grid de Ideias */}
        {loadingDb ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[35vh] glass rounded-3xl border border-dashed border-white/20 p-8 text-center">
            <Inbox size={40} className="text-white/20 mb-3" />
            <h3 className="text-lg font-semibold mb-1 text-white">Nenhum registro nesta visualização</h3>
            <p className="text-xs text-white/40 max-w-sm">
              {activeTab === "quarantine"
                ? "Nenhuma sugestão de IA aguardando quarentena. Suba uma gravação para extrair novas ideias."
                : "Utilize o Quick Add (tecla Q) para capturar ideias rápidas sem atrito."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIdeas.map((idea, idx) => {
              const isQuarantined = idea.isQuarantined;

              return (
                <div
                  key={`${idea.id || "idea"}-${idx}`}
                  onClick={() => openIdea(idea)}
                  className={`glass glass-hover rounded-2xl p-6 flex flex-col group cursor-pointer relative overflow-hidden transition-all duration-200 ${
                    isQuarantined ? "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.08)]" : ""
                  }`}
                >
                  {isQuarantined && (
                    <div className="mb-3 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-medium flex items-center gap-1.5">
                      <ShieldAlert size={12} className="text-amber-400 shrink-0" />
                      <span>Quarentena: Exige validação humana</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <div className="flex items-center gap-2 text-xs font-medium text-white/60 bg-black/40 border border-white/5 px-3 py-1 rounded-full">
                      <Folder size={12} className="text-purple-400" /> {idea.project || "Caixa de Entrada"}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${idea.statusColor || "bg-purple-500"}`} />
                      <span className="text-xs text-white/60">{idea.status}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold mb-2 group-hover:text-purple-300 transition-colors relative z-10">
                    {idea.title}
                  </h3>

                  {idea.painPoint && (
                    <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-200/90 leading-tight">
                      <span className="font-semibold text-red-300">Dor: </span> {idea.painPoint}
                    </div>
                  )}

                  <p className="text-xs text-white/50 line-clamp-3 leading-relaxed flex-1 relative z-10">
                    {idea.desc}
                  </p>

                  {/* Barra de Ações Rápidas do Card */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between relative z-10">
                    {isQuarantined ? (
                      <div className="flex items-center gap-2 w-full justify-between">
                        <button
                          onClick={(e) => handleApproveQuarantined(idea, e)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 border border-emerald-500/30"
                        >
                          <CheckCircle2 size={13} /> Aprovar
                        </button>
                        <button
                          onClick={(e) => handleDiscardQuarantined(idea, e)}
                          className="p-1.5 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Descartar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {idea.promotedToProject ? (
                          <span className="text-[11px] text-purple-300 flex items-center gap-1 font-medium">
                            <Rocket size={12} /> Projeto: {idea.promotedToProject}
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/40">
                            {idea.department ? `#${idea.department}` : "#Geral"}
                          </span>
                        )}

                        <span className="text-xs font-medium text-purple-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Detalhes <ArrowRight size={13} />
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Completo da Ideia com Checkpoint de Promoção */}
      {selectedIdea && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="glass w-full max-w-4xl max-h-[90vh] rounded-3xl p-6 md:p-8 flex flex-col relative border border-white/15 shadow-2xl overflow-hidden">
            <button
              onClick={() => setSelectedIdea(null)}
              className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-2 rounded-full transition-colors z-20"
            >
              <X size={20} />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="flex flex-wrap items-center gap-3 mb-4 pr-10">
              <div className="flex items-center gap-2 text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-full">
                <Folder size={14} /> {selectedIdea.project || "Caixa de Entrada"}
              </div>

              {/* Seletor de Status da Ideia */}
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as IdeaStatus)}
                className="bg-neutral-900 border border-white/10 text-white rounded-full px-3 py-1 text-xs outline-none focus:border-purple-500"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.label} value={st.label}>
                    {st.label}
                  </option>
                ))}
              </select>

              {/* Seletor de Departamento */}
              <select
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value as DepartmentTag)}
                className="bg-neutral-900 border border-white/10 text-white rounded-full px-3 py-1 text-xs outline-none focus:border-purple-500"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    #{d}
                  </option>
                ))}
              </select>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white flex items-center gap-3">
              {selectedIdea.title}
            </h2>

            {/* Banner de Erro de Promoção */}
            {promotionError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{promotionError}</span>
              </div>
            )}

            {/* Corpo com Scroll */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Checkpoint: Dor / Problema */}
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                <label className="text-xs font-bold uppercase tracking-wider text-red-300 block mb-2 flex items-center gap-1.5">
                  <AlertCircle size={14} /> Definição Clara da Dor / Problema *
                </label>
                <textarea
                  value={editPainPoint}
                  onChange={(e) => setEditPainPoint(e.target.value)}
                  placeholder="Qual é a dor ou problema real que esta ideia resolve? (Obrigatório para o Checkpoint de Promoção a Projeto)"
                  rows={2}
                  className="w-full bg-black/40 border border-red-500/30 rounded-xl p-3 text-xs text-white placeholder:text-red-200/40 outline-none focus:border-red-400 transition-colors resize-none"
                />
              </div>

              {/* Descrição Completa */}
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                <h4 className="text-xs font-bold uppercase text-white/50 mb-2">Escopo / Análise Técnica</h4>
                <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {selectedIdea.desc}
                </div>
              </div>

              {/* Action Items se houver */}
              {selectedIdea.actionItems && selectedIdea.actionItems.length > 0 && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <h4 className="text-xs font-bold uppercase text-purple-300 mb-2">
                    Action Items Extraídos pela IA
                  </h4>
                  <ul className="space-y-1 text-xs text-purple-100">
                    {selectedIdea.actionItems.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notas de Discussão */}
              <div>
                <h4 className="text-xs font-bold uppercase text-white/50 mb-2">Discussão & Notas do Time</h4>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Escreva novas decisões, pontos alinhados ou especificações..."
                  rows={3}
                  className="w-full bg-white/5 rounded-xl border border-white/10 p-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Footer do Modal com Checkpoint de Promoção */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePromoteToProject}
                  disabled={isPromoting}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center gap-2"
                  title="Converte esta ideia em um Projeto Oficial com Kanban"
                >
                  {isPromoting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Rocket size={14} /> Checkpoint: Promover a Projeto
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleTargetTitle(`Alinhamento: ${selectedIdea.title}`);
                    setScheduleTargetProject(selectedIdea.project || "Geral");
                    setIsScheduleModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                  title="Agendar reunião sobre esta ideia no Google Agenda"
                >
                  <Calendar size={13} /> Agendar na Agenda
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedIdea(null)}
                  className="px-4 py-2 text-xs text-white/60 hover:text-white rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveIdeaDetails}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : "Salvar Alterações"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
