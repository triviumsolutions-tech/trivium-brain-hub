"use client";

import { BrainCircuit, Loader2 } from "lucide-react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useState } from "react";

export default function LoginPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      if (res.user && res.user.email) {
        await setDoc(
          doc(db, "users", res.user.uid),
          {
            uid: res.user.uid,
            email: res.user.email,
            displayName:
              res.user.displayName ||
              res.user.email.split("@")[0] ||
              "Membro Trivium",
            photoURL: res.user.photoURL || null,
            lastLogin: new Date().toISOString(),
            role: "Founder",
          },
          { merge: true }
        );
      }
      // O ClientLayout (roteador raiz) cuidará do redirecionamento automaticamente
    } catch (error) {
      console.error(error);
      alert("Erro ao fazer login com o Google.");
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative z-10 w-full">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      <div className="glass w-full max-w-md rounded-3xl p-8 flex flex-col items-center">
        <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl mb-6 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
          <BrainCircuit className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Trivium Brain Hub</h1>
        <p className="text-white/40 mb-8 text-center text-sm">Faça login com sua conta Google para acessar o Hub de ideias.</p>

        <div className="w-full space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white text-black font-medium py-3 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 mt-4 disabled:opacity-70"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.222 0-9.654-3.343-11.124-7.482l-6.571 4.819C9.656 39.663 16.318 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                Continuar com Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
