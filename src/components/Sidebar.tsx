"use client";
import { BrainCircuit, LayoutDashboard, PlusCircle, Settings, Library } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col p-6 hidden md:flex h-screen sticky top-0 z-50">
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
          <BrainCircuit className="w-6 h-6 text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Trivium Brain</span>
      </div>

      <nav className="flex-1 space-y-2">
        <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" href="/" active={pathname === "/"} />
        <SidebarItem icon={<Library size={20} />} label="Projetos" href="/projetos" active={pathname === "/projetos"} />
        <SidebarItem icon={<PlusCircle size={20} />} label="Nova Ideia" href="/nova-ideia" active={pathname === "/nova-ideia"} />
      </nav>

      <div className="mt-auto space-y-2">
        <SidebarItem icon={<Settings size={20} />} label="Configurações" href="/configuracoes" active={pathname === "/configuracoes"} />
        <button 
          onClick={() => signOut(auth)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-white/50 hover:text-red-400 hover:bg-red-500/10 text-left"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, href, active = false }: { icon: React.ReactNode, label: string, href: string, active?: boolean }) {
  return (
    <Link href={href} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}
