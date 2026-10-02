"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <div className="flex min-h-screen w-full">
      {!isLogin && <Sidebar />}
      <main className={`flex-1 ${!isLogin ? 'overflow-y-auto' : ''}`}>
        {children}
      </main>
    </div>
  );
}
