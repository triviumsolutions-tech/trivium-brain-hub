"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
import { UserProfile } from "@/types";
import {
  Calendar,
  Clock,
  Users,
  Video,
  ExternalLink,
  X,
  Loader2,
  Check,
  CheckCheck,
  Folder,
  UserPlus,
  Mail,
  UserCheck,
} from "lucide-react";

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProject?: string;
  defaultTitle?: string;
  existingProjects?: string[];
}

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  defaultProject = "",
  defaultTitle = "",
  existingProjects = [],
}: ScheduleMeetingModalProps) {
  const [title, setTitle] = useState(defaultTitle || "Alinhamento Estratégico Trivium");
  const [project, setProject] = useState(defaultProject || "Geral");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    // Formato local YYYY-MM-DDTHH:mm
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [durationMinutes, setDurationMinutes] = useState(30);

  // Usuários do Firestore (Membros da Equipe)
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [externalEmailsInput, setExternalEmailsInput] = useState("");

  // Formulário para cadastrar sócio/membro que ainda não logou
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Escuta os usuários cadastrados/logados no Firestore em tempo real
  useEffect(() => {
    if (!isOpen) return;

    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersList = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as UserProfile[];

      // Ordena por nome
      usersList.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
      setTeamUsers(usersList);
    });

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  // Alterna seleção individual de um membro
  const toggleUserEmail = (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    setSelectedUserEmails((prev) =>
      prev.includes(cleanEmail)
        ? prev.filter((e) => e !== cleanEmail)
        : [...prev, cleanEmail]
    );
  };

  // Alterna seleção de toda a equipe
  const toggleAllTeam = () => {
    const allEmails = teamUsers
      .map((u) => u.email?.toLowerCase().trim())
      .filter(Boolean) as string[];

    if (selectedUserEmails.length === allEmails.length && allEmails.length > 0) {
      setSelectedUserEmails([]);
    } else {
      setSelectedUserEmails(allEmails);
    }
  };

  // Cadastra membro/sócio diretamente no Firestore (ex: o 4º que ainda não logou)
  const handleAddNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !newMemberEmail.includes("@")) {
      alert("Por favor, digite um e-mail válido.");
      return;
    }

    setIsAddingMember(true);
    try {
      const cleanEmail = newMemberEmail.trim().toLowerCase();
      const docId = cleanEmail.replace(/[^a-z0-9]/g, "_");

      await setDoc(
        doc(db, "users", docId),
        {
          uid: docId,
          email: cleanEmail,
          displayName: newMemberName.trim() || cleanEmail.split("@")[0],
          role: "Founder",
          createdAt: new Date().toISOString(),
          status: "Convidado / Pré-cadastrado",
        },
        { merge: true }
      );

      // Auto-seleciona o membro recém-adicionado
      if (!selectedUserEmails.includes(cleanEmail)) {
        setSelectedUserEmails((prev) => [...prev, cleanEmail]);
      }

      setNewMemberName("");
      setNewMemberEmail("");
      setShowAddMember(false);
    } catch (err) {
      console.error("Erro ao adicionar membro:", err);
      alert("Erro ao cadastrar membro no Firestore.");
    } finally {
      setIsAddingMember(false);
    }
  };

  // Lista final consolidada de participantes
  const getConsolidatedAttendees = (): string[] => {
    const externals = externalEmailsInput
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"));

    return Array.from(new Set([...selectedUserEmails, ...externals]));
  };

  // Converte data local para formato do Google Calendar (YYYYMMDDTHHmmssZ)
  const getGoogleCalendarDates = () => {
    try {
      const startDate = new Date(dateTime);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      const toGCalString = (d: Date) => {
        return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      };

      return `${toGCalString(startDate)}/${toGCalString(endDate)}`;
    } catch {
      return "";
    }
  };

  const generateGoogleCalendarUrl = (attendeesList: string[]) => {
    const dates = getGoogleCalendarDates();
    const details = `${description}\n\nReunião registrada pelo Trivium Hub\nProjeto: ${project}\nParticipantes: ${attendeesList.join(", ")}\nCriar ata após a reunião no Trivium Hub.`;
    const attendeesParam = attendeesList.join(",");

    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${dates}&details=${encodeURIComponent(details)}`;

    if (attendeesParam) {
      url += `&add=${encodeURIComponent(attendeesParam)}`;
    }

    return url;
  };

  const handleSaveAndOpenCalendar = async () => {
    if (!title.trim()) {
      alert("Por favor, preencha o título da reunião.");
      return;
    }

    const attendees = getConsolidatedAttendees();

    setIsSaving(true);
    try {
      // Salva no Firestore
      await addDoc(collection(db, "meetings"), {
        title: title.trim(),
        relatedProject: project,
        meetingMinutes:
          description ||
          "Reunião agendada na Google Agenda. Aguardando realização para transcrição/ata.",
        scheduledAt: dateTime,
        attendees,
        status: "Agendada",
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent(
        "MEETING_SCHEDULED",
        title,
        `Projeto: ${project} • Participantes: ${attendees.length} (${attendees.join(", ")})`
      );

      // Abre a Google Agenda em nova aba com todos os dados preenchidos
      const gcalUrl = generateGoogleCalendarUrl(attendees);
      window.open(gcalUrl, "_blank");

      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar agendamento.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalAttendees = getConsolidatedAttendees();
  const allTeamSelected =
    teamUsers.length > 0 && selectedUserEmails.length === teamUsers.length;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass w-full max-w-xl rounded-3xl p-6 md:p-8 flex flex-col relative animate-in zoom-in-95 duration-200 shadow-2xl border border-white/15 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/5 p-2 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        <header className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Calendar size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Agendar Reunião de Equipe
            </h2>
            <p className="text-xs text-white/50">
              Integração com Google Agenda, Google Meet e ata no Trivium Hub
            </p>
          </div>
        </header>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-white/70 font-semibold mb-1.5">
              Título da Reunião
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Alinhamento de Sprint • Lectio"
              className="w-full bg-neutral-900 border border-white/15 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 font-semibold mb-1.5 flex items-center gap-1.5">
                <Folder size={13} className="text-blue-400" /> Projeto Vinculado
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                list="projects-list"
                placeholder="Ex: Lectio ou Geral"
                className="w-full bg-neutral-900 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors"
              />
              <datalist id="projects-list">
                {existingProjects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-white/70 font-semibold mb-1.5 flex items-center gap-1.5">
                <Clock size={13} className="text-purple-400" /> Duração Estimada
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      durationMinutes === mins
                        ? "bg-blue-600/30 border-blue-500 text-blue-300"
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-white/70 font-semibold mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-emerald-400" /> Data e Horário
            </label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full bg-neutral-900 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* SELETOR DE MEMBROS DA EQUIPE (FIRESTORE USERS) */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-indigo-400" />
                <span className="font-semibold text-white">Membros da Equipe Trivium</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                  {selectedUserEmails.length}/{teamUsers.length} selecionados
                </span>
              </div>

              <div className="flex items-center gap-2">
                {teamUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllTeam}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                  >
                    <CheckCheck size={12} />
                    {allTeamSelected ? "Desmarcar Todos" : "Toda a Equipe"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20"
                >
                  <UserPlus size={12} />
                  {showAddMember ? "Fechar" : "+ Convidar / 4º Sócio"}
                </button>
              </div>
            </div>

            {/* Formulário inline para cadastrar novo membro (ex: 4º sócio) */}
            {showAddMember && (
              <form
                onSubmit={handleAddNewMember}
                className="p-3 bg-neutral-950/80 rounded-xl border border-purple-500/30 space-y-2 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between text-[11px] text-purple-300 font-semibold">
                  <span>Pré-cadastrar sócio no Firestore:</span>
                  <span className="text-white/40 text-[10px]">Ficará salvo para reuniões</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nome (Ex: Sócio 4)"
                    className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-purple-500"
                  />
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Email (Ex: socio4@trivium.tech)"
                    required
                    className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddMember(false)}
                    className="px-3 py-1 text-white/50 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {isAddingMember ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Salvar Sócio
                  </button>
                </div>
              </form>
            )}

            {/* Grid dos Usuários do Firestore */}
            {teamUsers.length === 0 ? (
              <div className="p-3 bg-neutral-900/50 rounded-xl border border-dashed border-white/10 text-center text-white/40 text-[11px]">
                Nenhum membro logado detectado no Firestore ainda.
                <button
                  type="button"
                  onClick={() => setShowAddMember(true)}
                  className="text-purple-400 hover:underline ml-1 font-semibold"
                >
                  Clique aqui para pré-cadastrar os sócios
                </button>
                .
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {teamUsers.map((u) => {
                  const isSelected = selectedUserEmails.includes(u.email?.toLowerCase().trim());
                  const initial = (u.displayName || u.email || "T").charAt(0).toUpperCase();

                  return (
                    <button
                      key={u.id || u.email}
                      type="button"
                      onClick={() => toggleUserEmail(u.email)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500/60 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-white/70"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-purple-900/40 text-purple-300 border border-purple-500/30"
                        }`}
                      >
                        {isSelected ? <Check size={14} /> : initial}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white truncate text-xs">
                            {u.displayName || u.email.split("@")[0]}
                          </span>
                          <span className="text-[9px] font-mono px-1 rounded bg-white/10 text-white/50">
                            Founder
                          </span>
                        </div>
                        <span className="text-[10px] text-white/50 truncate block">
                          {u.email}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Campo para e-mails externos adicionais */}
            <div className="pt-2 border-t border-white/5">
              <label className="block text-white/60 text-[11px] font-medium mb-1 flex items-center gap-1.5">
                <Mail size={12} className="text-white/40" /> Outros Convidados (E-mails externos opcionais)
              </label>
              <input
                type="text"
                value={externalEmailsInput}
                onChange={(e) => setExternalEmailsInput(e.target.value)}
                placeholder="ex: cliente@empresa.com, parceiro@gmail.com"
                className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Resumo de Participantes */}
            {totalAttendees.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-indigo-300 pt-1">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={13} /> Total: {totalAttendees.length} participante(s) no convite
                </span>
                <span className="text-[10px] text-white/40 truncate max-w-xs">
                  {totalAttendees.join(", ")}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-white/70 font-semibold mb-1.5">
              Pauta / Objetivo da Reunião
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descreva os tópicos a serem alinhados com a equipe..."
              className="w-full bg-neutral-900 border border-white/15 rounded-xl p-3 text-white outline-none focus:border-blue-500 resize-none transition-colors text-xs"
            />
          </div>

          {/* Dica do Google Meet */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between text-blue-200">
            <span className="flex items-center gap-2">
              <Video size={16} className="text-blue-400 shrink-0" />
              <span>O Google Agenda gerará a sala do Google Meet automaticamente no convite.</span>
            </span>
            <a
              href="https://meet.google.com/new"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-blue-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
            >
              Criar Meet agora <ExternalLink size={12} />
            </a>
          </div>

          {/* Ações */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors font-medium text-xs"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSaveAndOpenCalendar}
              disabled={isSaving}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={16} /> Salvar & Abrir Google Agenda ({totalAttendees.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
