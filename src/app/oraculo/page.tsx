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
  Square,
  Radio,
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
        "Olá, sócio da Trivium! Sou o **Oráculo Institucional**. Minha inteligência é alimentada por todas as ideias, reuniões e projetos cadastrados no Brain Hub.\n\nVocê pode **falar comigo por voz** ou texto, e eu te responderei com a voz do Oráculo em áudio! O que você gostaria de analisar hoje?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Estados de Áudio e Modo Conversa por Voz
  const [autoSpeak, setAutoSpeak] = useState(true); // Fala a resposta automaticamente
  const [autoSendVoice, setAutoSendVoice] = useState(true); // Envia automaticamente ao concluir gravação
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const speechKeepAliveRef = useRef<NodeJS.Timeout | null>(null);

  // Painel de Estatísticas
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega e sincroniza as vozes do navegador
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setAvailableVoices(v);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (speechKeepAliveRef.current) {
        clearInterval(speechKeepAliveRef.current);
      }
    };
  }, []);

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

  // Seleciona a melhor voz disponível em português do Brasil
  const getBestVoice = (): SpeechSynthesisVoice | null => {
    const voices =
      availableVoices.length > 0
        ? availableVoices
        : typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis.getVoices()
        : [];

    // 1. Vozes neurais / naturais em português brasileiro (Edge / Windows 11)
    const naturalPtBr = voices.find(
      (v) =>
        (v.lang === "pt-BR" || v.lang === "pt_BR") &&
        (v.name.includes("Natural") || v.name.includes("Neural"))
    );
    if (naturalPtBr) return naturalPtBr;

    // 2. Google Português do Brasil (Chrome)
    const googlePtBr = voices.find(
      (v) =>
        (v.lang === "pt-BR" || v.lang === "pt_BR") &&
        v.name.toLowerCase().includes("google")
    );
    if (googlePtBr) return googlePtBr;

    // 3. Qualquer voz pt-BR
    const anyPtBr = voices.find((v) => v.lang === "pt-BR" || v.lang === "pt_BR");
    if (anyPtBr) return anyPtBr;

    // 4. Qualquer voz em português
    const anyPt = voices.find((v) => v.lang.toLowerCase().startsWith("pt"));
    return anyPt || null;
  };

  // Parar síntese de voz
  const stopSpeaking = () => {
    if (speechKeepAliveRef.current) {
      clearInterval(speechKeepAliveRef.current);
      speechKeepAliveRef.current = null;
    }
    activeUtterancesRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingIndex(null);
  };

  // Síntese de Voz Robusta (Anti-Garbage-Collector + Chunking por sentenças + PT-BR)
  const speakText = (text: string, index: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Seu navegador não suporta síntese de voz.");
      return;
    }

    if (speakingIndex === index) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    // 1. Limpa markdown e símbolos para pronúncia natural em português
    const cleanText = text
      .replace(/```[\s\S]*?```/g, " Trecho de código omitido. ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\|.*?\|/g, " ")
      .replace(/#{1,6}\s+/g, "")
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*>\s+/gm, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .replace(/\.{2,}/g, ".")
      .trim();

    if (!cleanText) return;

    // 2. Destrava o motor de voz (necessário no Chromium)
    window.speechSynthesis.resume();

    // 3. Divide em frases curtas para contornar o bug de 15 segundos do Chromium
    const rawSentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const sentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 0);

    if (sentences.length === 0) return;

    const voice = getBestVoice();
    const utterances: SpeechSynthesisUtterance[] = [];

    sentences.forEach((sentence, sIdx) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      if (voice) utterance.voice = voice;
      utterance.lang = "pt-BR";
      utterance.rate = 1.05; // Cadência moderna e agradável
      utterance.pitch = 1.0;

      if (sIdx === sentences.length - 1) {
        utterance.onend = () => {
          stopSpeaking();
        };
      }

      utterance.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          console.error("Erro na síntese:", e);
        }
        if (sIdx === sentences.length - 1) {
          stopSpeaking();
        }
      };

      utterances.push(utterance);
    });

    // Mantém as referências vivas para o Garbage Collector do V8 não cancelar o áudio
    activeUtterancesRef.current = utterances;
    setSpeakingIndex(index);

    // Keepalive para o bug de pausa do Chromium
    speechKeepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    // Fala as sentenças
    utterances.forEach((utt) => {
      window.speechSynthesis.speak(utt);
    });
  };

  // Estados de Gravação de Áudio via MediaRecorder + Gemini
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inicia gravação com alta fidelidade fonética
  const startRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        alert("Seu navegador não possui suporte para gravação de áudio.");
        return;
      }

      // Interrompe fala anterior se o Oráculo estiver falando
      stopSpeaking();

      // Solicita microfone com cancelamento de ruído e eco para alta clareza
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
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
        if (audioBlob.size < 400) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.webm");

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (data.transcript && data.transcript.trim()) {
            const recognized = data.transcript.trim();
            setInput(recognized);

            if (autoSendVoice) {
              // Modo Conversa por Voz Direta: envia e ativa a resposta em áudio!
              await handleSend(recognized, true);
            }
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

  // Envio de pergunta e RAG consultivo
  const handleSend = async (questionText?: string, forceAutoSpeak?: boolean) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || isLoading) return;

    // Se estiver falando, interrompe antes da nova consulta
    stopSpeaking();

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

      setMessages((prev) => {
        const nextMessages = [...prev, assistantMessage];
        const newAssistantIndex = nextMessages.length - 1;

        // Fala automaticamente se autoSpeak estiver ligado ou se for por comando de voz
        if (forceAutoSpeak || autoSpeak) {
          setTimeout(() => {
            speakText(data.answer, newAssistantIndex);
          }, 200);
        }

        return nextMessages;
      });
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
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-300 relative">
      {/* Header do Oráculo com Controles de Voz e Métricas */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Oráculo Institucional
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold tracking-wider uppercase">
                Voz Bidirecional • RAG
              </span>
            </h1>
            <p className="text-xs text-white/50">
              Converse em áudio ou texto com o cérebro consultivo de projetos, ideias e atas da Trivium
            </p>
          </div>
        </div>

        {/* Controles de Voz e Estatísticas */}
        <div className="flex items-center gap-2">
          {/* Botão de Auto-Falar / Voz Ativa */}
          <button
            onClick={() => {
              if (speakingIndex !== null) stopSpeaking();
              setAutoSpeak(!autoSpeak);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              autoSpeak
                ? "bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                : "bg-white/5 text-white/50 hover:text-white border-white/10"
            }`}
            title={
              autoSpeak
                ? "Resposta por voz ativa: o Oráculo lerá as respostas em áudio automaticamente"
                : "Resposta por voz silenciada: o Oráculo responderá apenas em texto"
            }
          >
            {autoSpeak ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Volume2 size={15} className="text-purple-300" />
                <span>Voz do Oráculo: Ligada</span>
              </>
            ) : (
              <>
                <VolumeX size={15} />
                <span>Voz do Oráculo: Silenciada</span>
              </>
            )}
          </button>

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
        </div>
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

      {/* Floating Audio Status quando o Oráculo está falando */}
      {speakingIndex !== null && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-purple-950/95 border border-purple-500/60 shadow-[0_0_30px_rgba(147,51,234,0.6)] backdrop-blur-md animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-1 h-3.5">
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s] h-2.5" />
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.3s] h-4" />
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s] h-3" />
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s] h-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Oráculo Falando</span>
            <span className="text-[10px] text-purple-300">Resposta em áudio ativa</span>
          </div>
          <button
            onClick={stopSpeaking}
            className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all"
          >
            <Square size={11} className="fill-current" /> Parar Áudio
          </button>
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
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 transition-all ${
                  speakingIndex === i
                    ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.6)] ring-2 ring-purple-400"
                    : "bg-purple-600/30 border border-purple-500/30 text-purple-300"
                }`}
              >
                <BrainCircuit size={16} />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-5 text-sm leading-relaxed relative group transition-all ${
                msg.role === "user"
                  ? "bg-purple-600 text-white rounded-tr-none shadow-[0_0_20px_rgba(147,51,234,0.25)]"
                  : speakingIndex === i
                  ? "glass text-white/90 rounded-tl-none border border-purple-500 shadow-[0_0_25px_rgba(147,51,234,0.3)] ring-1 ring-purple-500/50"
                  : "glass text-white/90 rounded-tl-none border border-white/10 shadow-lg"
              }`}
            >
              {/* Equalizador animado quando esta resposta estiver sendo falada */}
              {speakingIndex === i && (
                <div className="flex items-center justify-between mb-3 px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 h-3">
                      <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s] h-2" />
                      <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.3s] h-3.5" />
                      <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s] h-2.5" />
                      <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s] h-4" />
                    </div>
                    <span>Oráculo falando em áudio...</span>
                  </div>
                  <button
                    onClick={stopSpeaking}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-600/90 hover:bg-purple-600 text-white text-[11px] font-bold"
                  >
                    <Square size={10} className="fill-current" /> Parar
                  </button>
                </div>
              )}

              <div className="whitespace-pre-wrap">{msg.content}</div>

              <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/10 text-[10px] text-white/40">
                <span>{msg.timestamp}</span>

                <div className="flex items-center gap-3">
                  {msg.role === "assistant" && (
                    <>
                      <button
                        onClick={() => speakText(msg.content, i)}
                        className={`flex items-center gap-1 transition-colors px-2 py-1 rounded-md ${
                          speakingIndex === i
                            ? "bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40"
                            : "hover:text-white hover:bg-white/5"
                        }`}
                        title={speakingIndex === i ? "Parar áudio" : "Ouvir resposta em voz"}
                      >
                        {speakingIndex === i ? (
                          <>
                            <VolumeX size={13} className="text-red-400" />
                            <span className="text-red-300">Parar</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={13} />
                            <span>Ouvir</span>
                          </>
                        )}
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
            <span>O Oráculo está cruzando o histórico e estruturando a resposta...</span>
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
        {/* Botão de Gravação de Áudio */}
        <button
          type="button"
          onClick={toggleListening}
          disabled={isTranscribing || isLoading}
          className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 ${
            isRecording
              ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.7)]"
              : "text-white/60 hover:text-white hover:bg-white/10"
          }`}
          title={isRecording ? "Concluir fala e enviar" : "Falar em áudio com o Oráculo"}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Toggle de Envio Automático por Voz */}
        <button
          type="button"
          onClick={() => setAutoSendVoice(!autoSendVoice)}
          className={`text-[10px] px-2 py-1 rounded-lg border transition-all shrink-0 hidden sm:flex items-center gap-1.5 ${
            autoSendVoice
              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
              : "bg-white/5 border-white/10 text-white/40"
          }`}
          title={
            autoSendVoice
              ? "Envio direto: ao parar de gravar, o Oráculo já consulta e responde em áudio"
              : "Revisar texto: ao parar de gravar, preenche o campo sem enviar automaticamente"
          }
        >
          <Radio size={12} className={autoSendVoice ? "text-purple-400" : "text-white/40"} />
          <span>{autoSendVoice ? "Voz Direta (Auto-envio)" : "Revisar texto"}</span>
        </button>

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 bg-red-500/10 border border-red-500/25 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-xs font-bold text-red-300">
                Ouvindo você... {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
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
                <Check size={12} /> Concluir e Consultar
              </button>
            </div>
          </div>
        ) : isTranscribing ? (
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 text-purple-300 text-xs font-mono animate-in fade-in duration-150">
            <Loader2 size={15} className="animate-spin text-purple-400" />
            <span>O Gemini está transcrevendo sua fala com alta fidelidade fonética...</span>
          </div>
        ) : (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte em áudio ou texto sobre ideias, reuniões e estatísticas da Trivium..."
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
