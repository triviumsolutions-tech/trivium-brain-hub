"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
import {
  Calendar,
  Clock,
  Users,
  Video,
  ExternalLink,
  X,
  Loader2,
  Check,
  Folder,
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
  const [attendeesInput, setAttendeesInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

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

  const generateGoogleCalendarUrl = () => {
    const dates = getGoogleCalendarDates();
    const details = `${description}\n\nReunião registrada pelo Trivium Brain Hub\nProjeto: ${project}\nCriar ata após a reunião no Brain Hub.`;
    const attendees = attendeesInput
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .join(",");

    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${dates}&details=${encodeURIComponent(details)}`;

    if (attendees) {
      url += `&add=${encodeURIComponent(attendees)}`;
    }

    return url;
  };

  const handleSaveAndOpenCalendar = async () => {
    if (!title.trim()) {
      alert("Por favor, preencha o título da reunião.");
      return;
    }

    setIsSaving(true);
    try {
      const attendees = attendeesInput
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      // Salva no Firestore
      await addDoc(collection(db, "meetings"), {
        title: title.trim(),
        relatedProject: project,
        meetingMinutes: description || "Reunião agendada na Google Agenda. Aguardando realização para transcrição/ata.",
        scheduledAt: dateTime,
        attendees,
        status: "Agendada",
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent("MEETING_SCHEDULED", title, `Projeto: ${project} • Participantes: ${attendees.length}`);

      // Abre a Google Agenda em nova aba com todos os dados preenchidos
      const gcalUrl = generateGoogleCalendarUrl();
      window.open(gcalUrl, "_blank");

      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar agendamento.");
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass w-full max-w-xl rounded-3xl p-6 md:p-8 flex flex-col relative animate-in zoom-in-95 duration-200 shadow-2xl border border-white/15 max-h-[90vh] overflow-y-auto">
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
              Integração com Google Agenda, Google Meet e ata no Brain Hub
            </p>
          </div>
        </header>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-white/70 font-semibold mb-1.5">Título da Reunião</label>
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

          <div>
            <label className="block text-white/70 font-semibold mb-1.5 flex items-center gap-1.5">
              <Users size={13} className="text-yellow-400" /> Convidados da Equipe (E-mails separados por vírgula)
            </label>
            <input
              type="text"
              value={attendeesInput}
              onChange={(e) => setAttendeesInput(e.target.value)}
              placeholder="ex: gustavo@trivium.com, socio@trivium.com"
              className="w-full bg-neutral-900 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-white/70 font-semibold mb-1.5">Pauta / Objetivo da Reunião</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descreva os tópicos a serem alinhados com a equipe..."
              className="w-full bg-neutral-900 border border-white/15 rounded-xl p-3 text-white outline-none focus:border-blue-500 resize-none transition-colors"
            />
          </div>

          {/* Dica do Google Meet */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between text-blue-200">
            <span className="flex items-center gap-2">
              <Video size={16} className="text-blue-400" />
              <span>O Google Agenda adicionará a sala do Google Meet automaticamente no convite.</span>
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
          <div className="pt-3 flex gap-3">
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
                  <Check size={16} /> Salvar & Abrir Google Agenda
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
