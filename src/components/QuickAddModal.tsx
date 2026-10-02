"use client";

import { useState, useEffect } from "react";
import { Zap, X, Loader2, Tag, Folder } from "lucide-react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
import { DepartmentTag } from "@/types";

const DEPARTMENTS: DepartmentTag[] = [
  "Engenharia",
  "Marketing",
  "Produto",
  "Design",
  "Vendas",
  "Operações",
  "Geral",
];

export function QuickAddModal({
  isOpen,
  onClose,
  existingProjects = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  existingProjects?: string[];
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [department, setDepartment] = useState<DepartmentTag>("Geral");
  const [project, setProject] = useState("Caixa de Entrada");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fecha com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "ideas"), {
        title: title.trim(),
        desc: desc.trim() || "Captura rápida via Quick Add.",
        project: project || "Caixa de Entrada",
        status: "Rascunho",
        statusColor: "bg-slate-500",
        department,
        inbox: true,
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent("QUICK_ADD_CREATED", docRef.id, `Ideia: ${title} (${department})`);

      setTitle("");
      setDesc("");
      onClose();
    } catch (err) {
      console.error("Erro no Quick Add:", err);
      alert("Erro ao salvar ideia rápida.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass w-full max-w-lg rounded-3xl p-6 relative border border-purple-500/30 shadow-[0_0_50px_rgba(147,51,234,0.2)] animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Quick Add Universal</h3>
            <p className="text-xs text-white/50">Capture o caos criativo sem atrito. Salva na Caixa de Entrada.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-1.5 block">
              Título da Ideia *
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Refatorar pipeline de deploy para zero downtime..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-purple-500 transition-colors text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-1.5 block">
              Descrição Breve / Dor Resolvida
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="O que motivou essa ideia ou qual dor do usuário/cliente ela resolve?"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-purple-500 transition-colors text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-1.5 flex items-center gap-1.5">
                <Tag size={12} /> Departamento
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as DepartmentTag)}
                className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-purple-500 text-xs"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-1.5 flex items-center gap-1.5">
                <Folder size={12} /> Projeto
              </label>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-purple-500 text-xs"
              >
                <option value="Caixa de Entrada">📥 Caixa de Entrada Geral</option>
                {existingProjects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Zap size={14} /> Salvar Imediatamente
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
