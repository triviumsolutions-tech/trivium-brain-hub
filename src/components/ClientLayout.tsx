"use client";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Sincroniza usuário logado no Firestore (coleção "users")
      if (currentUser && currentUser.email) {
        const userRef = doc(db, "users", currentUser.uid);
        setDoc(
          userRef,
          {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName:
              currentUser.displayName ||
              currentUser.email.split("@")[0] ||
              "Membro Trivium",
            photoURL: currentUser.photoURL || null,
            lastLogin: new Date().toISOString(),
            role: "Founder",
          },
          { merge: true }
        ).catch((err) => {
          console.warn("Aviso ao sincronizar usuário no Firestore:", err);
        });
      }

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
    <div className="flex flex-col md:flex-row min-h-screen w-full">
      {!isLogin && <Sidebar />}
      <main className={`flex-1 min-w-0 w-full ${!isLogin ? "overflow-y-auto pb-24 md:pb-0" : ""}`}>
        {children}
      </main>
    </div>
  );
}
