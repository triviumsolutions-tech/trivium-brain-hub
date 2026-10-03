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

import { useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* 1. TOP BAR MOBILE (Visível apenas em telas < 768px) */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-40 select-none w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.4)] flex items-center justify-center shrink-0">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-white leading-none">
              Trivium Brain
            </span>
            <span className="text-[9px] text-purple-400 font-mono tracking-wider font-semibold">
              FOUNDER
            </span>
          </div>
        </Link>

        {/* Botão de Menu para Ações Secundárias */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl text-white/70 hover:text-white bg-white/5 border border-white/10 active:scale-95 transition-all text-xs flex items-center gap-1.5"
          aria-label="Abrir menu do sistema"
        >
          <Settings size={16} />
          <span className="text-[11px] font-medium">Mais</span>
        </button>

        {/* Dropdown Menu Mobile */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-neutral-950/95 backdrop-blur-2xl border-b border-white/15 p-4 shadow-2xl animate-in slide-in-from-top-2 duration-150 flex flex-col gap-2">
            <Link
              href="/como-usar"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                pathname === "/como-usar" ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <BookOpen size={16} className="text-purple-400" />
              <span>Manual / Como Usar</span>
            </Link>

            <Link
              href="/configuracoes"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                pathname === "/configuracoes" ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings size={16} className="text-blue-400" />
              <span>Configurações & Integrações</span>
            </Link>

            <div className="pt-2 border-t border-white/10 mt-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut(auth);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16} />
                <span>Sair da Sessão</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. SIDEBAR DESKTOP (Visível em md: >= 768px) */}
      <aside className="w-64 border-r border-white/10 bg-black/40 backdrop-blur-2xl flex-col p-5 hidden md:flex h-screen sticky top-0 z-50 select-none shrink-0">
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
            label="Hub"
            href="/"
            active={pathname === "/"}
          />
          <SidebarItem
            icon={<Library size={18} />}
            label="Projects"
            href="/projetos"
            active={pathname.startsWith("/projetos")}
          />
          <SidebarItem
            icon={<Network size={18} />}
            label="Brain"
            href="/grafo"
            active={pathname === "/grafo"}
          />
          <SidebarItem
            icon={<Sparkles size={18} />}
            label="Trivium AI"
            href="/trivium-ai"
            active={pathname === "/trivium-ai" || pathname === "/oraculo"}
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

      {/* 3. BOTTOM NAVIGATION DOCK (Mobile < 768px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-neutral-950/90 backdrop-blur-2xl border-t border-white/10 px-3 py-2 flex items-center justify-around shadow-[0_-10px_35px_rgba(0,0,0,0.8)] pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <MobileNavItem
          icon={<LayoutDashboard size={20} />}
          label="Hub"
          href="/"
          active={pathname === "/"}
        />
        <MobileNavItem
          icon={<Library size={20} />}
          label="Projects"
          href="/projetos"
          active={pathname.startsWith("/projetos")}
        />
        <MobileNavItem
          icon={<Network size={20} />}
          label="Brain"
          href="/grafo"
          active={pathname === "/grafo"}
        />
        <MobileNavItem
          icon={<Sparkles size={20} />}
          label="Trivium AI"
          href="/trivium-ai"
          active={pathname === "/trivium-ai" || pathname === "/oraculo"}
          isAiCockpit={true}
        />
      </nav>
    </>
  );
}

function MobileNavItem({
  icon,
  label,
  href,
  active = false,
  isAiCockpit = false,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  isAiCockpit?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all active:scale-95 ${
        isAiCockpit && active
          ? "bg-gradient-to-t from-purple-600/30 to-purple-500/10 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
          : isAiCockpit
          ? "text-purple-300 hover:text-white"
          : active
          ? "text-white font-bold"
          : "text-white/50 hover:text-white"
      }`}
    >
      <div className="relative">
        {icon}
        {active && !isAiCockpit && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400" />
        )}
      </div>
      <span className={`text-[10px] tracking-tight mt-1 ${active ? "font-bold text-white" : "font-medium"}`}>
        {label}
      </span>
    </Link>
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
