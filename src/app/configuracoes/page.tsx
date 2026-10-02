"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { User, signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
} from "firebase/firestore";
import {
  UserCircle,
  Bot,
  Shield,
  Sparkles,
  LogOut,
  Check,
  Crown,
  History,
  Eye,
  Key,
  ExternalLink,
  Users,
  UserPlus,
  Loader2,
} from "lucide-react";
import { AuditLog, UserProfile } from "@/types";

export default function ConfiguracoesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isSavingMember, setIsSavingMember] = useState(false);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => setUser(u));

    // Escuta os usuários cadastrados/logados no Firestore
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as UserProfile[];
      fetched.sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "")
      );
      setTeamUsers(fetched);
    });

    // Escuta os últimos registros de Auditoria
    const q = query(
      collection(db, "audit_logs"),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    const unsubLogs = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AuditLog[];
      setLogs(fetchedLogs);
    });

    return () => {
      unsubAuth();
      unsubUsers();
      unsubLogs();
    };
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !newMemberEmail.includes("@")) {
      alert("Por favor, informe um e-mail válido.");
      return;
    }
    setIsSavingMember(true);
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
          status: "Pré-cadastrado",
        },
        { merge: true }
      );
      setNewMemberName("");
      setNewMemberEmail("");
      setShowAddMember(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar sócio.");
    } finally {
      setIsSavingMember(false);
    }
  };

  return (
    <div className="p-8 md:p-10 max-w-6xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
      <header className="mb-10 pb-6 border-b border-white/10">
        <span className="text-xs uppercase font-mono px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-2 inline-block">
          Governança & Segurança
        </span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Configurações & Governança</h1>
        <p className="text-white/50 text-sm mt-1">
          Gerencie permissões, o modo operacional e os registros de auditoria do sistema.
        </p>
      </header>

      {/* BANNER FOUNDER MODE (Fase 1) */}
      <section className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-purple-900/40 via-neutral-900/80 to-blue-900/30 border border-purple-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Crown size={120} className="text-purple-400" />
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_25px_rgba(147,51,234,0.5)]">
              <Crown size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white">Founder Mode Ativo (Fase 1)</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Flat Hierarchy
                </span>
              </div>
              <p className="text-xs text-white/60 max-w-xl leading-relaxed">
                Todos os sócios possuem privilégios totais (Super Admin). Transições de checkpoints e aprovações do fluxo de IA podem ser feitas com autoaprovação imediata, focando em máxima velocidade.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5">
              <Eye size={12} className="text-purple-400" /> Visão Panorâmica
            </span>
            <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5">
              <Key size={12} className="text-amber-400" /> Autoaprovação
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna 1 & 2: Perfil, IA e Audit Trail */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Perfil */}
          <div className="glass rounded-3xl p-6 flex flex-col gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                <UserCircle size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Perfil da Conta</h3>
            </div>

            <div className="flex items-center gap-5 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-purple-900/50 border-2 border-purple-500/40 flex items-center justify-center text-xl font-bold text-white">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "T"}
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-white">{user?.displayName || "Sócio Trivium"}</h4>
                <p className="text-white/50 text-xs">{user?.email || "founder@trivium.tech"}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                  <Check size={12} />
                  Role: Founder (Acesso Total)
                </div>
              </div>
            </div>
          </div>

          {/* Equipe & Sócios Trivium (Membros & Firestore) */}
          <div className="glass rounded-3xl p-6 flex flex-col gap-4 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <Users size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">Equipe & Sócios Trivium</h3>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {teamUsers.length}/4 Sócios
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    Contas conectadas pelo Google Auth e salvas no Firestore para agendamentos e reuniões.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddMember(!showAddMember)}
                className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <UserPlus size={14} />
                {showAddMember ? "Fechar" : "+ Cadastrar Sócio"}
              </button>
            </div>

            {/* Form inline para cadastrar sócio */}
            {showAddMember && (
              <form
                onSubmit={handleAddMember}
                className="p-4 bg-neutral-900/80 rounded-2xl border border-purple-500/30 space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between text-xs text-purple-300 font-semibold">
                  <span>Pré-cadastrar sócio (ex: 4º membro da equipe)</span>
                  <span className="text-[11px] text-white/40">Ficará disponível no seletor de reuniões</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nome completo do sócio"
                    className="bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-purple-500"
                  />
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="E-mail (ex: socio4@trivium.tech)"
                    required
                    className="bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMember(false)}
                    className="px-3 py-1.5 text-white/50 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMember}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {isSavingMember ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Salvar no Firestore
                  </button>
                </div>
              </form>
            )}

            {/* Lista dos Sócios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teamUsers.length === 0 ? (
                <div className="col-span-2 p-6 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-2xl">
                  Nenhum usuário detectado na coleção ainda. Faça login ou use o botão &quot;+ Cadastrar Sócio&quot; acima.
                </div>
              ) : (
                teamUsers.map((u) => {
                  const initial = (u.displayName || u.email || "T").charAt(0).toUpperCase();
                  return (
                    <div
                      key={u.id || u.email}
                      className="p-3.5 bg-neutral-900/60 rounded-2xl border border-white/5 flex items-center gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-900 to-indigo-900 border border-purple-500/30 flex items-center justify-center font-bold text-sm text-purple-200 shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-semibold text-white text-xs truncate">
                            {u.displayName || u.email.split("@")[0]}
                          </h5>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                            Founder
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 truncate">{u.email}</p>
                        {u.lastLogin ? (
                          <span className="text-[9px] text-emerald-400/80 font-mono mt-0.5 block">
                            Último acesso: {new Date(u.lastLogin).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[9px] text-amber-400/80 font-mono mt-0.5 block">
                            Status: Pré-cadastrado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Audit Trail (Registro de Auditoria) */}
          <div className="glass rounded-3xl p-6 flex flex-col gap-4 border border-white/10">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Audit Trail (Trilha de Auditoria)</h3>
                  <p className="text-xs text-white/50">Registro silencioso de ações, aprovações e checkpoints no sistema.</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-white/40">Últimos 10 eventos</span>
            </div>

            <div className="space-y-2 mt-2 max-h-64 overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="p-4 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-2xl">
                  Nenhum evento registrado ainda. As ações de aprovação, promoção e edição aparecerão aqui.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-neutral-900/60 rounded-xl border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-purple-300 font-mono text-[11px]">
                        [{log.action}]
                      </span>{" "}
                      <span className="text-white/70">{log.details || log.target}</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-mono shrink-0 ml-3">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Coluna 3: IA e Sessão */}
        <div className="flex flex-col gap-6">
          <div className="glass rounded-3xl p-6 flex flex-col gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                <Bot size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Motor de IA</h3>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5 mb-1">
                  <Sparkles size={13} className="text-amber-400" /> Modelo Ativo
                </span>
                <p className="text-xs text-purple-300 font-mono">Gemini 3.8 Flash</p>
                <p className="text-[11px] text-white/40 mt-1">
                  RAG, ingestão multimodal, extração de lousa e oráculo por voz.
                </p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                <span className="text-xs font-semibold text-white block mb-1">Quarentena Automática</span>
                <p className="text-[11px] text-emerald-400 font-mono">Ativa (Human-in-the-loop)</p>
                <p className="text-[11px] text-white/40 mt-1">
                  IA estritamente proibida de criar projetos autônomos.
                </p>
              </div>
            </div>
          </div>

          {/* Integrações de Ecossistema */}
          <div className="glass rounded-3xl p-6 flex flex-col gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <ExternalLink size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Integrações</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-white">Atlassian Jira</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono">
                    Conectado (KAN)
                  </span>
                </div>
                <p className="text-[11px] text-white/50 mb-2">
                  triviumsolutions.atlassian.net • Quadro #1
                </p>
                <a
                  href="https://triviumsolutions.atlassian.net/jira/software/projects/KAN/boards/1?filter=&groupBy=none"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border border-blue-500/30"
                >
                  Abrir Quadro Jira KAN <ExternalLink size={12} />
                </a>
              </div>

              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-white">Google Agenda & Meet</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    Ativo
                  </span>
                </div>
                <p className="text-[11px] text-white/50">
                  Agendamento de reuniões com criação automática de salas Google Meet e convite para a equipe.
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 flex flex-col gap-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 text-red-400 rounded-xl">
                <Shield size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Sessão</h3>
            </div>

            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors font-semibold text-xs mt-2"
            >
              <LogOut size={15} />
              Encerrar Sessão (Sair)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
