import { BrainCircuit } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative z-10 w-full">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      <div className="glass w-full max-w-md rounded-3xl p-8 flex flex-col items-center">
        <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl mb-6 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
          <BrainCircuit className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Trivium Brain Hub</h1>
        <p className="text-white/40 mb-8 text-center text-sm">Faça login para acessar o ecossistema de ideias.</p>

        <div className="w-full space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1 ml-1">E-mail</label>
            <input type="email" placeholder="seu@email.com" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1 ml-1">Senha</label>
            <input type="password" placeholder="••••••••" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors" />
          </div>
          
          <Link href="/" className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-xl mt-6 transition-colors text-center shadow-[0_0_15px_rgba(147,51,234,0.2)]">
            Entrar no Hub
          </Link>
          
          <button className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl mt-2 transition-colors border border-white/5 flex items-center justify-center gap-2">
            Entrar com Conta Google
          </button>
        </div>
      </div>
    </div>
  );
}
