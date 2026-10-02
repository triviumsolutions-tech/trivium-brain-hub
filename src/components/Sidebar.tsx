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
    <aside className="w-64 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col p-6 hidden md:flex h-screen sticky top-0 z-50">
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-[0_0_15px_rgba(147,51,234,0.4)]">
          <BrainCircuit className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Trivium Brain
          </span>
          <span className="text-[10px] text-purple-400 font-mono tracking-wider">FOUNDER MODE</span>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        <SidebarItem
          icon={<LayoutDashboard size={19} />}
          label="Dashboard / Hub"
          href="/"
          active={pathname === "/"}
        />
        <SidebarItem
          icon={<Library size={19} />}
          label="Projetos & Kanban"
          href="/projetos"
          active={pathname.startsWith("/projetos")}
        />
        <SidebarItem
          icon={<Network size={19} />}
          label="Trivium Graph"
          href="/grafo"
          active={pathname === "/grafo"}
          badge="Novo"
        />
        <SidebarItem
          icon={<Sparkles size={19} className="text-purple-400" />}
          label="Oráculo IA"
          href="/oraculo"
          active={pathname === "/oraculo"}
          badge="RAG"
        />
        <SidebarItem
          icon={<BookOpen size={19} className="text-emerald-400" />}
          label="Como Usar"
          href="/como-usar"
          active={pathname === "/como-usar"}
          badge="Guia"
        />
      </nav>

      <div className="mt-auto space-y-2 pt-4 border-t border-white/5">
        <SidebarItem
          icon={<Settings size={19} />}
          label="Configurações"
          href="/configuracoes"
          active={pathname === "/configuracoes"}
        />
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-white/50 hover:text-red-400 hover:bg-red-500/10 text-left"
        >
          <LogOut size={19} />
          <span className="font-medium text-sm">Sair</span>
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
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
        active
          ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10"
          : "text-white/50 hover:text-white hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-medium text-sm">{label}</span>
      </div>
      {badge && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {badge}
        </span>
      )}
    </Link>
  );
}
