"use client";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Lógica de bloqueio:
      // Se não tem usuário e tentou acessar qualquer coisa (menos o login), joga pro login
      if (!currentUser && pathname !== "/login") {
        router.push("/login");
      } 
      // Se tem usuário e ele tentou acessar a tela de login, joga ele pra home
      else if (currentUser && pathname === "/login") {
        router.push("/");
      }
    });
    return () => unsub();
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-black">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  // Não renderiza o layout principal até redirecionar se não tiver usuário logado
  if (!user && !isLogin) return null;

  return (
    <div className="flex min-h-screen w-full">
      {!isLogin && <Sidebar />}
      <main className={`flex-1 ${!isLogin ? 'overflow-y-auto' : ''}`}>
        {children}
      </main>
    </div>
  );
}
