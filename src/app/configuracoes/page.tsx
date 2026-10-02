"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { User, signOut } from "firebase/auth";
import { UserCircle, Bot, Shield, Bell, Sparkles, LogOut, Check } from "lucide-react";

export default function ConfiguracoesPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <div className="p-10 max-w-5xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
      <header className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Configurações</h1>
        <p className="text-white/50">Gerencie sua conta e preferências do painel Trivium.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Coluna 1: Perfil e IA */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="glass rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                <UserCircle className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-medium">Perfil da Conta</h2>
            </div>
            
            <div className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/5">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-purple-500/50" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-purple-900/50 border-2 border-purple-500/50 flex items-center justify-center text-2xl font-bold">
                  {user?.displayName?.charAt(0) || "T"}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{user?.displayName || "Usuário da Trivium"}</h3>
                <p className="text-white/50 text-sm">{user?.email || "Carregando email..."}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                  <Check className="w-3.5 h-3.5" />
                  Conta Verificada (Google Auth)
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-medium">Motor de Inteligência Artificial</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-5 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <p className="font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Modelo Padrão de Extração</p>
                  <p className="text-white/50 text-sm mt-1">O motor que transcreve e filtra os dados das reuniões enviadas no Dashboard.</p>
                </div>
                <div className="px-4 py-2 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg text-sm font-medium">
                  Gemini 1.5 Pro
                </div>
              </div>

              <div className="flex justify-between items-center p-5 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <p className="font-medium">Upload de Mídia</p>
                  <p className="text-white/50 text-sm mt-1">Capacidade de arquivos de áudio/vídeo permitidos por vez na API.</p>
                </div>
                <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium">
                  Até 20MB (Vercel)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2: Preferências */}
        <div className="flex flex-col gap-6">
          <div className="glass rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg">
                <Bell className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-medium">Notificações</h2>
            </div>
            
            <div className="flex flex-col gap-5 mt-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-white/70">Novas ideias do time</span>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-9 h-5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-white/70">Relatórios semanais (Em breve)</span>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" disabled />
                  <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/50 after:border-gray-500 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </div>
              </label>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-medium">Segurança</h2>
            </div>
            
            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors font-medium text-sm mt-2"
            >
              <LogOut className="w-4 h-4" />
              Encerrar Sessão (Sair)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
