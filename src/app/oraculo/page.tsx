"use client";

import { useState, useEffect, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Sparkles,
  Send,
  Loader2,
  BrainCircuit,
  HelpCircle,
  Lightbulb,
  Copy,
  Check,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  BarChart3,
  Folder,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Idea, Project, MeetingDoc } from "@/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface StatsData {
  totalProjects: number;
  projectsByStatus: Record<string, number>;
  totalIdeas: number;
  ideasByDepartment: Record<string, number>;
  totalMeetings: number;
}

const PRESET_QUESTIONS = [
  "Quais projetos estão em desenvolvimento e quais estão no Backlog?",
  "Valide um projeto: veja quais ideias aprovadas já têm tarefas e o que falta criar.",
  "Resuma as principais dores levantadas nas ideias e reuniões.",
  "Existe alguma ideia aprovada que já pode ser promovida a projeto?",
  "O que já decidimos sobre a arquitetura e visão do Trivium Brain Hub?",
];

export default function OraculoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá, fundador da Trivium! Sou o **Oráculo Institucional**. Minha memória é alimentada por todas as ideias, reuniões e projetos cadastrados no Brain Hub.\n\nVocê pode conversar comigo por **texto ou por voz**! O que você gostaria de consultar ou analisar sobre o histórico da nossa empresa hoje?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Estados de Voz
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const recognitionRef = useRef<unknown>(null);

  // Painel de Estatísticas
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Carrega Estatísticas Consolidadas
  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const [ideasSnap, projectsSnap, meetingsSnap] = await Promise.all([
        getDocs(collection(db, "ideas")),
        getDocs(collection(db, "projects")),
        getDocs(collection(db, "meetings")),
      ]);

      const projects = projectsSnap.docs.map((d) => d.data() as Project);
      const ideas = ideasSnap.docs.map((d) => d.data() as Idea);
      const meetings = meetingsSnap.docs.map((d) => d.data() as MeetingDoc);

      const projStatusMap: Record<string, number> = {
        Backlog: 0,
        Desenvolvimento: 0,
        Pausado: 0,
        Finalizado: 0,
      };
      projects.forEach((p) => {
        const st = p.status || "Backlog";
        projStatusMap[st] = (projStatusMap[st] || 0) + 1;
      });

      const depMap: Record<string, number> = {};
      ideas.forEach((i) => {
        const dep = i.department || "Geral";
        depMap[dep] = (depMap[dep] || 0) + 1;
      });

      setStats({
        totalProjects: projects.length,
        projectsByStatus: projStatusMap,
        totalIdeas: ideas.length,
        ideasByDepartment: depMap,
        totalMeetings: meetings.length,
      });
    } catch (e) {
      console.error("Erro ao carregar estatísticas:", e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const toggleStats = () => {
    if (!showStats && !stats) {
      loadStats();
    }
    setShowStats(!showStats);
  };

  // Estados de Gravação de Áudio via MediaRecorder + Gemini
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inicia gravação de áudio com microfone nativo
  const startRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        alert("Seu navegador não possui suporte para gravação de áudio.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 500) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.webm");

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (data.transcript) {
            setInput(data.transcript);
          } else if (data.error) {
            alert("Erro na transcrição: " + data.error);
          }
        } catch (err) {
          console.error("Erro ao enviar áudio:", err);
          alert("Falha ao transcrever o áudio.");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error("Erro no microfone:", err);
      const errorObj = err as { name?: string; message?: string };
      if (
        errorObj.name === "NotAllowedError" ||
        errorObj.name === "PermissionDeniedError"
      ) {
        alert(
          "Permissão do microfone negada. Clique no ícone de cadeado/configurações ao lado de localhost na barra de endereço do seu navegador e permita o Microfone."
        );
      } else {
        alert(
          "Não foi possível iniciar a gravação. Verifique se seu microfone está conectado e permitido nas configurações do navegador."
        );
      }
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const toggleListening = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Síntese de Voz (Text-to-Speech)
  const toggleSpeak = (text: string, index: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Seu navegador não suporta síntese de voz.");
      return;
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Remove marcações markdown antes de falar
    const cleanText = text
      .replace(/[#*`_~-]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || isLoading) return;

    if (isListening && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setIsListening(false);
    }

    const userMessage: Message = {
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!questionText) setInput("");
    setIsLoading(true);

    try {
      // Coleta o acervo do Firestore em tempo real para RAG
      const [ideasSnap, projectsSnap, meetingsSnap] = await Promise.all([
        getDocs(collection(db, "ideas")),
        getDocs(collection(db, "projects")),
        getDocs(collection(db, "meetings")),
      ]);

      const ideas = ideasSnap.docs.map((d) => d.data() as Idea);
      const projects = projectsSnap.docs.map((d) => d.data() as Project);
      const meetings = meetingsSnap.docs.map((d) => d.data() as MeetingDoc);

      const contextData = `
PROJETOS CADASTRADOS (${projects.length}):
${projects
  .map(
    (p) =>
      `- Projeto: ${p.name} | Status: ${p.status} | Departamento: ${
        p.department || "Geral"
      } | Dor: ${p.painPoint || "N/A"} | Tarefas Mapeadas no Kanban (${
        (p.tasks || []).length
      }): ${
        (p.tasks || []).map((t) => `[${t.status}] ${t.title}`).join("; ") ||
        "Nenhuma tarefa cadastrada no Kanban ainda"
      }`
  )
  .join("\n")}

IDEIAS NO HUB (${ideas.length}):
${ideas
  .map(
    (i) =>
      `- Ideia: ${i.title} (Projeto: ${i.project}) | Status: ${i.status} | Departamento: ${
        i.department || "Geral"
      } | Dor: ${i.painPoint || "N/A"} | Descrição: ${i.desc}`
  )
  .join("\n\n")}

ATAS DE REUNIÕES (${meetings.length}):
${meetings
  .map(
    (m) =>
      `- Ata: ${m.title || "Reunião"} (Projeto: ${m.relatedProject || "Geral"}) | Resumo: ${
        m.meetingMinutes || "N/A"
      }`
  )
  .join("\n\n")}
      `;

      const response = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: textToSend.trim(),
          contextData,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro desconhecido no Oráculo");

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Erro ao consultar o Oráculo.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Desculpe, não consegui consultar o acervo neste momento. Motivo: ${message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      {/* Header do Oráculo */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Oráculo Institucional
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold tracking-wider uppercase">
                RAG + Voz + BI
              </span>
            </h1>
            <p className="text-xs text-white/50">
              Cérebro consultivo conectado a todas as decisões, atas, métricas e ideias da Trivium
            </p>
          </div>
        </div>

        {/* Botão de Métricas & Estatísticas */}
        <button
          onClick={toggleStats}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            showStats
              ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.4)]"
              : "bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border-white/10"
          }`}
        >
          <BarChart3 size={15} />
          <span>{showStats ? "Fechar Métricas" : "Métricas & Estatísticas"}</span>
        </button>
      </header>

      {/* Painel Expansível de Métricas & Estatísticas */}
      {showStats && (
        <div className="mb-4 glass rounded-3xl p-6 border border-white/15 shadow-2xl animate-in slide-in-from-top duration-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-purple-400" />
              Painel Executivo de Dados da Trivium
            </h3>
            {isLoadingStats && <Loader2 size={16} className="animate-spin text-purple-400" />}
          </div>

          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-white/50 flex items-center gap-1.5">
                  <Folder size={14} className="text-blue-400" /> Projetos Totais
                </span>
                <span className="text-3xl font-extrabold mt-2 text-white">{stats.totalProjects}</span>
                <div className="mt-3 flex gap-1">
                  <div className="h-1.5 rounded-full bg-blue-500 flex-1" title="Projetos Registrados" />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-white/50 flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-400" /> Em Desenvolvimento
                </span>
                <span className="text-3xl font-extrabold mt-2 text-purple-400">
                  {stats.projectsByStatus["Desenvolvimento"] || 0}
                </span>
                <span className="text-[11px] text-white/40 mt-1">
                  {stats.projectsByStatus["Backlog"] || 0} no Backlog • {stats.projectsByStatus["Finalizado"] || 0} Entregues
                </span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-white/50 flex items-center gap-1.5">
                  <Lightbulb size={14} className="text-yellow-400" /> Ideias no Acervo
                </span>
                <span className="text-3xl font-extrabold mt-2 text-yellow-400">{stats.totalIdeas}</span>
                <span className="text-[11px] text-white/40 mt-1">Distribuídas em departamentos</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-white/50 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" /> Atas de Reuniões
                </span>
                <span className="text-3xl font-extrabold mt-2 text-emerald-400">{stats.totalMeetings}</span>
                <span className="text-[11px] text-white/40 mt-1">Alimentando a memória do RAG</span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-white/40">Carregando métricas da empresa...</div>
          )}
        </div>
      )}

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 mt-1">
                <BrainCircuit size={16} />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-5 text-sm leading-relaxed relative group ${
                msg.role === "user"
                  ? "bg-purple-600 text-white rounded-tr-none shadow-[0_0_20px_rgba(147,51,234,0.25)]"
                  : "glass text-white/90 rounded-tl-none border border-white/10 shadow-lg"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/10 text-[10px] text-white/40">
                <span>{msg.timestamp}</span>

                <div className="flex items-center gap-3">
                  {msg.role === "assistant" && (
                    <>
                      <button
                        onClick={() => toggleSpeak(msg.content, i)}
                        className={`flex items-center gap-1 transition-colors ${
                          speakingIndex === i ? "text-purple-400 font-bold" : "hover:text-white"
                        }`}
                        title={speakingIndex === i ? "Parar áudio" : "Ouvir resposta em voz"}
                      >
                        {speakingIndex === i ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        <span>{speakingIndex === i ? "Parar" : "Ouvir"}</span>
                      </button>

                      <button
                        onClick={() => handleCopy(msg.content, i)}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        {copiedIndex === i ? (
                          <>
                            <Check size={12} className="text-emerald-400" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copiar
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center text-white/50 text-xs py-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/20 flex items-center justify-center text-purple-400 animate-spin">
              <Loader2 size={16} />
            </div>
            <span>O Oráculo está cruzando o histórico da Trivium...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões de Perguntas Rápidas */}
      {messages.length <= 2 && (
        <div className="mb-4">
          <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5 font-medium">
            <HelpCircle size={13} /> Sugestões para consultar o acervo:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {PRESET_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="text-left text-xs p-3 glass hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all border border-white/5 flex items-center gap-2"
              >
                <Lightbulb size={13} className="text-yellow-400 shrink-0" />
                <span className="truncate">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Campo de Entrada com Voz e Envio */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="glass rounded-2xl p-2 border border-white/15 flex items-center gap-2 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={toggleListening}
          disabled={isTranscribing || isLoading}
          className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 ${
            isRecording
              ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.7)]"
              : "text-white/60 hover:text-white hover:bg-white/10"
          }`}
          title={isRecording ? "Concluir gravação" : "Gravar áudio pelo microfone"}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 bg-red-500/10 border border-red-500/25 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-xs font-bold text-red-300">
                Gravando... {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
              <div className="hidden sm:flex items-center gap-1 h-3">
                <span className="w-1 bg-red-400 rounded-full animate-bounce [animation-delay:0.1s] h-2" />
                <span className="w-1 bg-red-400 rounded-full animate-bounce [animation-delay:0.3s] h-3.5" />
                <span className="w-1 bg-red-400 rounded-full animate-bounce [animation-delay:0.2s] h-2.5" />
                <span className="w-1 bg-red-400 rounded-full animate-bounce [animation-delay:0.4s] h-4" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="text-white/50 hover:text-white text-xs px-2 py-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow"
              >
                <Check size={12} /> Concluir
              </button>
            </div>
          </div>
        ) : isTranscribing ? (
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 text-purple-300 text-xs font-mono animate-in fade-in duration-150">
            <Loader2 size={15} className="animate-spin text-purple-400" />
            <span>O Gemini está transcrevendo seu áudio com alta precisão...</span>
          </div>
        ) : (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte qualquer coisa sobre ideias, reuniões e estatísticas da Trivium..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none"
          />
        )}

        <button
          type="submit"
          disabled={isLoading || isRecording || isTranscribing || !input.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(147,51,234,0.4)] disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          <span>Consultar</span>
        </button>
      </form>
    </div>
  );
}
