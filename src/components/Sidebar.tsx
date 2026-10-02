"use client";

import {
  BrainCircuit,
  LayoutDashboard,
  Settings,
  Library,
  Network,
  Sparkles,
  BookOpen,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-white/10 bg-black/40 backdrop-blur-2xl flex flex-col p-5 hidden md:flex h-screen sticky top-0 z-50 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8 px-2 pt-1">
        <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.45)] flex items-center justify-center shrink-0">
          <BrainCircuit className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-base tracking-tight text-white">
            Trivium Brain
          </span>
          <span className="text-[10px] text-purple-400 font-mono tracking-widest font-semibold">
            FOUNDER MODE
          </span>
        </div>
      </div>

      {/* Seção Principal de Navegação */}
      <div className="px-2 mb-2 text-[10px] font-mono uppercase tracking-wider text-white/35 font-semibold">
        Workspace
      </div>

      <nav className="space-y-1">
        <SidebarItem
          icon={<LayoutDashboard size={18} />}
          label="Dashboard / Hub"
          href="/"
          active={pathname === "/"}
        />
        <SidebarItem
          icon={<Library size={18} />}
          label="Projetos & Kanban"
          href="/projetos"
          active={pathname.startsWith("/projetos")}
        />
        <SidebarItem
          icon={<Network size={18} />}
          label="Trivium Graph"
          href="/grafo"
          active={pathname === "/grafo"}
        />
        <SidebarItem
          icon={<Sparkles size={18} />}
          label="Oráculo IA"
          href="/oraculo"
          active={pathname === "/oraculo"}
        />
      </nav>

      {/* Seção de Suporte e Governança */}
      <div className="px-2 mt-6 mb-2 text-[10px] font-mono uppercase tracking-wider text-white/35 font-semibold">
        Sistema
      </div>

      <nav className="space-y-1">
        <SidebarItem
          icon={<BookOpen size={18} />}
          label="Como Usar"
          href="/como-usar"
          active={pathname === "/como-usar"}
        />
      </nav>

      {/* Footer / Configurações & Sair */}
      <div className="mt-auto space-y-1 pt-4 border-t border-white/10">
        <SidebarItem
          icon={<Settings size={18} />}
          label="Configurações"
          href="/configuracoes"
          active={pathname === "/configuracoes"}
        />
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-white/50 hover:text-red-400 hover:bg-red-500/10 text-left group"
        >
          <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
          <span className="font-medium text-xs">Sair da Sessão</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  href,
  active = false,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 group relative ${
        active
          ? "bg-white/[0.08] text-white border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.04)]"
          : "text-white/60 hover:text-white hover:bg-white/[0.04]"
      }`}
    >
      {/* Indicador sutil de item ativo na esquerda */}
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-purple-500 to-blue-500" />
      )}

      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`transition-colors shrink-0 ${
            active
              ? "text-white"
              : "text-white/50 group-hover:text-white"
          }`}
        >
          {icon}
        </span>
        <span
          className={`text-xs tracking-tight truncate ${
            active ? "font-semibold text-white" : "font-medium text-white/70 group-hover:text-white"
          }`}
        >
          {label}
        </span>
      </div>

      {badge && (
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 ml-2">
          {badge}
        </span>
      )}
    </Link>
  );
}
