"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
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
  ImagePlus,
  X,
  FileImage,
  Maximize2,
  ListTodo,
  Plus,
  ArrowUpRight,
  CheckSquare,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { Idea, Project, MeetingDoc, KanbanTask } from "@/types";

interface ImageAttachment {
  name: string;
  mimeType: string;
  data: string; // base64 string
  previewUrl: string;
}

interface SuggestedTaskItem {
  title: string;
  description?: string;
  priority?: "alta" | "media" | "baixa";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  images?: ImageAttachment[];
  model?: string;
  suggestedTasks?: SuggestedTaskItem[];
  targetProject?: string;
  tasksAdded?: boolean;
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
  "Mapeie as ideias do projeto Calculadora de Churrasco e monte as tarefas que faltam no Kanban.",
  "Resuma as principais dores levantadas nas ideias e atas de reuniões.",
  "Existe alguma ideia aprovada que já pode ser promovida a projeto?",
  "Envie uma imagem de arquitetura ou print para eu cruzar com o acervo da Trivium.",
];

export default function TriviumAIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá, sócio da Trivium! Sou a **Trivium AI** — o cérebro executivo, estratégico e técnico central da nossa empresa.\n\nVocê pode me pedir para **mapear tarefas pendentes no Kanban**, organizar prioridades, conversar em áudio ou me enviar **prints de telas e arquiteturas**!\n\nPor exemplo: peça *\"Mapeie as tarefas que faltam no Kanban do projeto Calculadora de Churrasco\"*, e eu listarei os tickets para você aprovar e adicionar com 1 clique!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Estados de Imagem
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de Tarefas do Kanban (Human-in-the-Loop)
  const [selectedTasksMap, setSelectedTasksMap] = useState<Record<number, Record<number, boolean>>>({});
  const [applyingTaskMessageIndex, setApplyingTaskMessageIndex] = useState<number | null>(null);

  // Estados de Áudio e Modo Conversa por Voz
  const [autoSpeak, setAutoSpeak] = useState(true); // Resposta por voz automática
  const [autoSendVoice, setAutoSendVoice] = useState(true); // Envio direto ao concluir áudio
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const speechKeepAliveRef = useRef<NodeJS.Timeout | null>(null);

  // Reconhecimento de Fala em Tempo Real (Web Speech API)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<unknown>(null);

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

  // 1. Carrega histórico persistido do localStorage no primeiro render (Next tick para evitar cascading render)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trivium_ai_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTimeout(() => {
            setMessages(parsed);
          }, 0);
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar histórico persistido:", e);
    }
  }, []);

  // 2. Salva histórico no localStorage sempre que as mensagens forem atualizadas
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (messages.length > 1 || (messages.length === 1 && messages[0].role === "user")) {
        localStorage.setItem("trivium_ai_messages", JSON.stringify(messages));
      }
    } catch (e) {
      console.warn("Erro ao salvar histórico persistido:", e);
    }
  }, [messages]);

  // Limpa o chat e inicia uma nova sessão limpa
  const handleClearChat = () => {
    if (confirm("Deseja iniciar uma nova conversa e limpar o histórico anterior?")) {
      stopSpeaking();
      if (typeof window !== "undefined") {
        localStorage.removeItem("trivium_ai_messages");
      }
      setMessages([
        {
          role: "assistant",
          content:
            "Nova conversa iniciada! Sou a **Trivium AI**.\n\nO que você gostaria de analisar, mapear para o Kanban ou criar hoje?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setSelectedTasksMap({});
    }
  };

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, liveTranscript]);

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

  // Melhor voz em português do Brasil
  const getBestVoice = (): SpeechSynthesisVoice | null => {
    const voices =
      availableVoices.length > 0
        ? availableVoices
        : typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis.getVoices()
        : [];

    const naturalPtBr = voices.find(
      (v) =>
        (v.lang === "pt-BR" || v.lang === "pt_BR") &&
        (v.name.includes("Natural") || v.name.includes("Neural"))
    );
    if (naturalPtBr) return naturalPtBr;

    const googlePtBr = voices.find(
      (v) =>
        (v.lang === "pt-BR" || v.lang === "pt_BR") &&
        v.name.toLowerCase().includes("google")
    );
    if (googlePtBr) return googlePtBr;

    const anyPtBr = voices.find((v) => v.lang === "pt-BR" || v.lang === "pt_BR");
    if (anyPtBr) return anyPtBr;

    const anyPt = voices.find((v) => v.lang.toLowerCase().startsWith("pt"));
    return anyPt || null;
  };

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

  const speakText = (text: string, index: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (speakingIndex === index) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    // Limpa Markdown rigorosamente para fala fluida
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

    window.speechSynthesis.resume();

    const rawSentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const sentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 0);

    if (sentences.length === 0) return;

    const voice = getBestVoice();
    const utterances: SpeechSynthesisUtterance[] = [];

    sentences.forEach((sentence, sIdx) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      if (voice) utterance.voice = voice;
      utterance.lang = "pt-BR";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      if (sIdx === sentences.length - 1) {
        utterance.onend = () => {
          stopSpeaking();
        };
      }

      utterance.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          console.error("Erro na síntese de voz:", e);
        }
        if (sIdx === sentences.length - 1) {
          stopSpeaking();
        }
      };

      utterances.push(utterance);
    });

    activeUtterancesRef.current = utterances;
    setSpeakingIndex(index);

    speechKeepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    utterances.forEach((utt) => {
      window.speechSynthesis.speak(utt);
    });
  };

  // Upload e Processamento de Imagens
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione arquivos de imagem válidos (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("A imagem selecionada deve ter no máximo 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setAttachedImages((prev) => [
          ...prev,
          {
            name: file.name || `imagem-${Date.now()}`,
            mimeType: file.type || "image/png",
            data: result,
            previewUrl: result,
          },
        ]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => processImageFile(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Suporte a Colar Imagens da Área de Transferência (Ctrl+V)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
        }
      }
    }
  }, []);

  // Inicia Reconhecimento de Fala & Gravação
  const startRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        alert("Seu navegador não possui suporte para gravação de áudio.");
        return;
      }

      stopSpeaking();
      setLiveTranscript("");

      // 1. Inicia Web Speech API em tempo real (caso disponível no navegador)
      if (typeof window !== "undefined") {
        const SpeechRec =
          (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

        if (SpeechRec) {
          try {
            const rec = new (SpeechRec as new () => {
              lang: string;
              continuous: boolean;
              interimResults: boolean;
              start: () => void;
              stop: () => void;
              onresult: (e: {
                results: Array<Array<{ transcript: string }> & { isFinal: boolean }>;
              }) => void;
              onerror: (err: unknown) => void;
            })();

            rec.lang = "pt-BR";
            rec.continuous = true;
            rec.interimResults = true;

            rec.onresult = (event) => {
              let text = "";
              for (let i = 0; i < event.results.length; i++) {
                text += event.results[i][0].transcript + " ";
              }
              const cleaned = text.trim();
              if (cleaned) {
                setLiveTranscript(cleaned);
              }
            };

            rec.start();
            speechRecognitionRef.current = rec;
          } catch (e) {
            console.warn("Web Speech API não pôde iniciar:", e);
          }
        }
      }

      // 2. Gravação de alta fidelidade via MediaRecorder (garante fallback fonético robusto)
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

        // Para reconhecimento ao vivo
        if (speechRecognitionRef.current) {
          try {
            (speechRecognitionRef.current as { stop: () => void }).stop();
          } catch {}
          speechRecognitionRef.current = null;
        }

        // Determina a melhor transcrição
        let recognizedText = liveTranscript.trim();

        // Se Web Speech API não pegou ou ficou muito curta, envia o áudio ao Gemini
        if (!recognizedText && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          if (audioBlob.size > 400) {
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
                recognizedText = data.transcript.trim();
              }
            } catch (err) {
              console.error("Erro na transcrição Gemini:", err);
            } finally {
              setIsTranscribing(false);
            }
          }
        }

        if (recognizedText) {
          setInput(recognizedText);
          setLiveTranscript("");

          if (autoSendVoice) {
            await handleSend(recognizedText, true);
          }
        }
      };

      recorder.start(150);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error("Erro no microfone:", err);
      alert(
        "Não foi possível acessar o microfone. Verifique as permissões de áudio do seu navegador."
      );
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
    if (speechRecognitionRef.current) {
      try {
        (speechRecognitionRef.current as { stop: () => void }).stop();
      } catch {}
      speechRecognitionRef.current = null;
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
    setLiveTranscript("");
  };

  const toggleListening = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Funções de Gerenciamento das Tarefas Mapeadas
  const toggleTaskSelection = (messageIndex: number, taskIndex: number) => {
    setSelectedTasksMap((prev) => {
      const currentMsgMap = prev[messageIndex] || {};
      const currentSelected = currentMsgMap[taskIndex] !== false; // padrão é true
      return {
        ...prev,
        [messageIndex]: {
          ...currentMsgMap,
          [taskIndex]: !currentSelected,
        },
      };
    });
  };

  const getSelectedTasksCount = (messageIndex: number, totalTasks: number): number => {
    const currentMsgMap = selectedTasksMap[messageIndex] || {};
    let count = 0;
    for (let i = 0; i < totalTasks; i++) {
      if (currentMsgMap[i] !== false) {
        count++;
      }
    }
    return count;
  };

  // Aplica as Tarefas no Firestore do Projeto
  const handleApplyTasksToKanban = async (
    targetProjectName: string,
    tasksToApply: SuggestedTaskItem[],
    messageIndex: number
  ) => {
    try {
      setApplyingTaskMessageIndex(messageIndex);

      // Filtra apenas as tarefas selecionadas
      const msgSelection = selectedTasksMap[messageIndex] || {};
      const filteredTasks = tasksToApply.filter((_, idx) => msgSelection[idx] !== false);

      if (filteredTasks.length === 0) {
        alert("Selecione pelo menos uma tarefa para adicionar ao Kanban.");
        return;
      }

      // Busca os projetos no Firestore para identificar o documento
      const projSnap = await getDocs(collection(db, "projects"));
      const allProjs = projSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));

      // Match exato ou aproximado
      let matchedProj = allProjs.find(
        (p) =>
          p.name?.toLowerCase().trim() === targetProjectName.toLowerCase().trim() ||
          p.id?.toLowerCase().trim() === targetProjectName.toLowerCase().trim()
      );

      if (!matchedProj) {
        matchedProj = allProjs.find((p) =>
          p.name?.toLowerCase().includes(targetProjectName.toLowerCase().trim())
        );
      }

      const docId = matchedProj ? (matchedProj.id || matchedProj.name) : targetProjectName;
      const existingTasks: KanbanTask[] = matchedProj?.tasks || [];

      const newKanbanTasks: KanbanTask[] = filteredTasks.map((t) => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: t.title,
        description: t.description || "",
        status: "Backlog",
        priority: t.priority || "alta",
        createdAt: new Date().toISOString(),
      }));

      const updatedTasks = [...existingTasks, ...newKanbanTasks];

      await setDoc(doc(db, "projects", docId), { tasks: updatedTasks }, { merge: true });

      // Atualiza o estado da mensagem para mostrar sucesso
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex
            ? { ...msg, tasksAdded: true, targetProject: docId }
            : msg
        )
      );

      // Confirmação auditiva se voz estiver ativa
      if (autoSpeak) {
        speakText(
          `${newKanbanTasks.length} tarefas foram adicionadas com sucesso ao Backlog do projeto ${targetProjectName}!`,
          messageIndex
        );
      }
    } catch (err) {
      console.error("Erro ao aplicar tarefas ao Kanban:", err);
      alert("Não foi possível salvar as tarefas no Kanban do projeto.");
    } finally {
      setApplyingTaskMessageIndex(null);
    }
  };

  // Envio de Pergunta Multimodal (Texto + Áudio + Imagens + Histórico)
  const handleSend = async (questionText?: string, forceAutoSpeak?: boolean) => {
    const textToSend = (questionText !== undefined ? questionText : input).trim();
    const currentImages = [...attachedImages];

    if (!textToSend && currentImages.length === 0) return;
    if (isLoading) return;

    stopSpeaking();

    // Se o usuário disser algo como "pode adicionar essas tarefas", verifica se a última mensagem tinha tarefas
    const isAddingIntent =
      /(pode|sim|adicione|adiciona|adicionar|inclua|incluir|injetar|inserir|cadastrar).*(kanban|tarefa|ticket)/i.test(
        textToSend
      );

    if (isAddingIntent) {
      const lastTaskMsgEntry = messages
        .map((m, idx) => ({ m, idx }))
        .filter(
          ({ m }) =>
            m.role === "assistant" &&
            m.suggestedTasks &&
            m.suggestedTasks.length > 0 &&
            !m.tasksAdded
        )
        .pop();

      if (lastTaskMsgEntry && lastTaskMsgEntry.m.suggestedTasks && lastTaskMsgEntry.m.targetProject) {
        await handleApplyTasksToKanban(
          lastTaskMsgEntry.m.targetProject,
          lastTaskMsgEntry.m.suggestedTasks,
          lastTaskMsgEntry.idx
        );
      }
    }

    const userMessage: Message = {
      role: "user",
      content: textToSend || (currentImages.length > 0 ? "Análise de imagem anexada." : ""),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      images: currentImages.length > 0 ? currentImages : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!questionText) setInput("");
    setAttachedImages([]);
    setIsLoading(true);

    try {
      // Coleta acervo em tempo real do Firestore para RAG
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

      // Prepara histórico recente para continuidade
      const recentHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Prepara imagens em base64
      const imagesPayload = currentImages.map((img) => ({
        name: img.name,
        mimeType: img.mimeType,
        data: img.data,
      }));

      const response = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: textToSend,
          history: recentHistory,
          images: imagesPayload,
          contextData,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro desconhecido na Trivium AI");

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: data.model,
        suggestedTasks: data.suggestedTasks,
        targetProject: data.targetProject,
      };

      setMessages((prev) => {
        const nextList = [...prev, assistantMessage];
        const newAssistantIndex = nextList.length - 1;

        if (forceAutoSpeak || autoSpeak) {
          setTimeout(() => {
            speakText(data.answer, newAssistantIndex);
          }, 200);
        }

        return nextList;
      });
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Erro ao consultar a Trivium AI.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Desculpe, não consegui processar a consulta neste momento. Motivo: ${message}`,
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
    <div
      onPaste={handlePaste}
      className="flex flex-col h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-2rem)] max-w-5xl mx-auto p-3 sm:p-4 md:p-6 animate-in fade-in duration-300 relative"
    >
      {/* Input de arquivo invisível para imagens */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        multiple
        className="hidden"
      />

      {/* Modal de Visualização de Imagem em Tela Cheia */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewingImage}
              alt="Visualização"
              className="rounded-2xl max-w-full max-h-[85vh] object-contain shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header da Trivium AI */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(147,51,234,0.45)] shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              Trivium AI
              <span className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold tracking-wider uppercase">
                Multimodal
              </span>
            </h1>
            <p className="text-xs text-white/50 line-clamp-1 sm:line-clamp-none">
              Copiloto inteligente conectado a ideias, atas, métricas e Kanban
            </p>
          </div>
        </div>

        {/* Controles de Voz e Estatísticas */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Botão de Auto-Falar / Voz Ativa */}
          <button
            onClick={() => {
              if (speakingIndex !== null) stopSpeaking();
              setAutoSpeak(!autoSpeak);
            }}
            className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              autoSpeak
                ? "bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                : "bg-white/5 text-white/50 hover:text-white border-white/10"
            }`}
            title={
              autoSpeak
                ? "Resposta por voz ativa: a Trivium AI lerá as respostas em áudio automaticamente"
                : "Resposta por voz silenciada: a Trivium AI responderá apenas em texto"
            }
          >
            {autoSpeak ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Volume2 size={14} className="text-purple-300" />
                <span>Voz: Ligada</span>
              </>
            ) : (
              <>
                <VolumeX size={14} />
                <span>Voz: Silenciada</span>
              </>
            )}
          </button>

          {/* Botão de Métricas & Estatísticas */}
          <button
            onClick={toggleStats}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              showStats
                ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                : "bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border-white/10"
            }`}
          >
            <BarChart3 size={14} />
            <span>{showStats ? "Fechar" : "Métricas"}</span>
          </button>

          {/* Botão de Nova Conversa (Limpar Histórico e Resetar) */}
          <button
            onClick={handleClearChat}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 border bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/10 transition-all"
            title="Limpar histórico e começar uma nova conversa limpa"
          >
            <RotateCcw size={13} />
            <span>Nova Conversa</span>
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
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs text-white/50 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" /> Atas de Reuniões
                </span>
                <span className="text-3xl font-extrabold mt-2 text-emerald-400">{stats.totalMeetings}</span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-white/40">Carregando métricas da empresa...</div>
          )}
        </div>
      )}

      {/* Floating Audio Controller */}
      {speakingIndex !== null && (
        <div className="fixed bottom-28 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-purple-950/95 border border-purple-500/60 shadow-[0_0_30px_rgba(147,51,234,0.6)] backdrop-blur-md animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-1 h-3.5">
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s] h-2.5" />
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.3s] h-4" />
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s] h-3" />
            <span className="w-1 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s] h-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Trivium AI Falando</span>
            <span className="text-[10px] text-purple-300">Resposta em áudio ativa</span>
          </div>
          <button
            onClick={stopSpeaking}
            className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all"
          >
            <Square size={11} className="fill-current" /> Parar
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
              {/* Imagens anexadas na mensagem do usuário */}
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {msg.images.map((img, imgIdx) => (
                    <div
                      key={imgIdx}
                      onClick={() => setViewingImage(img.previewUrl)}
                      className="relative group/img cursor-pointer rounded-xl overflow-hidden border border-white/20 shadow-md hover:scale-105 transition-transform"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="w-28 h-28 object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 size={16} className="text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                    <span>Trivium AI falando em áudio...</span>
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

              {/* Card Interativo de Tarefas Mapeadas para o Kanban */}
              {msg.suggestedTasks && msg.suggestedTasks.length > 0 && (
                <div className="mt-4 p-4 rounded-2xl bg-neutral-900/90 border border-purple-500/30 shadow-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                        <ListTodo size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white">
                          Tarefas Mapeadas para o Kanban
                        </h4>
                        <span className="text-[10px] text-purple-300 font-mono">
                          Projeto: {msg.targetProject || "Geral"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-medium">
                      {msg.suggestedTasks.length} {msg.suggestedTasks.length === 1 ? "tarefa" : "tarefas"}
                    </span>
                  </div>

                  {/* Lista de Tarefas com Checkbox e Prioridade */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {msg.suggestedTasks.map((task, tIdx) => {
                      const isSelected = selectedTasksMap[i]?.[tIdx] !== false; // selecionado por padrão
                      return (
                        <div
                          key={tIdx}
                          onClick={() => toggleTaskSelection(i, tIdx)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                            isSelected
                              ? "bg-purple-950/40 border-purple-500/40 text-white"
                              : "bg-white/5 border-white/5 text-white/40 opacity-60"
                          }`}
                        >
                          <div className="pt-0.5 shrink-0">
                            {isSelected ? (
                              <CheckSquare size={14} className="text-purple-400" />
                            ) : (
                              <Square size={14} className="text-white/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold truncate">{task.title}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase shrink-0 ${
                                  task.priority === "alta"
                                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                    : task.priority === "media"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                }`}
                              >
                                {task.priority || "alta"}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-[11px] text-white/60 mt-1 leading-snug line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ação de Injeção no Kanban */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                    {msg.tasksAdded ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 size={15} /> Tarefas adicionadas com sucesso ao Backlog!
                        </span>
                        <Link
                          href={`/projetos/${encodeURIComponent(msg.targetProject || "")}`}
                          className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <span>Abrir Kanban do Projeto</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      </div>
                    ) : (
                      <>
                        <span className="text-[11px] text-white/50">
                          {getSelectedTasksCount(i, msg.suggestedTasks.length)} de {msg.suggestedTasks.length} selecionadas
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyTasksToKanban(msg.targetProject || "Geral", msg.suggestedTasks!, i)}
                          disabled={
                            applyingTaskMessageIndex === i ||
                            getSelectedTasksCount(i, msg.suggestedTasks.length) === 0
                          }
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.4)] disabled:opacity-50 transition-all ml-auto"
                        >
                          {applyingTaskMessageIndex === i ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Salvando no Kanban...</span>
                            </>
                          ) : (
                            <>
                              <Plus size={13} />
                              <span>Adicionar ao Kanban ({getSelectedTasksCount(i, msg.suggestedTasks.length)})</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

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
            <span>A Trivium AI está processando o acervo, imagens e cruzando tarefas...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões de Perguntas Rápidas */}
      {messages.length <= 2 && (
        <div className="mb-4">
          <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5 font-medium">
            <HelpCircle size={13} /> Sugestões para consultar o acervo da Trivium:
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

      {/* Miniaturas de Imagens Anexadas */}
      {attachedImages.length > 0 && (
        <div className="mb-2 p-2.5 glass rounded-2xl border border-purple-500/30 flex items-center gap-2.5 flex-wrap animate-in fade-in duration-150">
          <span className="text-[11px] text-purple-300 font-semibold flex items-center gap-1">
            <FileImage size={13} /> {attachedImages.length} imagem(ns) pronta(s) para análise:
          </span>
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={img.name}
                className="w-14 h-14 object-cover rounded-xl border border-white/20 shadow"
              />
              <button
                type="button"
                onClick={() => removeAttachedImage(idx)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Campo de Entrada Multimodal */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="glass rounded-2xl p-2 border border-white/15 flex items-center gap-2 shadow-2xl relative"
      >
        {/* Botão de Anexo de Imagem */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isRecording}
          className="p-2.5 rounded-xl text-white/60 hover:text-purple-300 hover:bg-white/10 transition-all flex items-center justify-center shrink-0"
          title="Anexar imagem (diagrama, arquitetura, print ou foto de lousa) ou cole com Ctrl+V"
        >
          <ImagePlus size={18} />
        </button>

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
          title={isRecording ? "Concluir fala e enviar" : "Falar em áudio com a Trivium AI"}
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
              ? "Envio direto: ao parar de falar, a Trivium AI já consulta e responde em áudio"
              : "Revisar texto: ao parar de falar, preenche o campo sem enviar automaticamente"
          }
        >
          <Radio size={12} className={autoSendVoice ? "text-purple-400" : "text-white/40"} />
          <span>{autoSendVoice ? "Voz Direta" : "Revisar texto"}</span>
        </button>

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 bg-red-500/10 border border-red-500/25 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-xs font-bold text-red-300 flex items-center gap-2">
                  Gravando... {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                </span>
                {liveTranscript && (
                  <span className="text-[11px] text-white/80 truncate max-w-md italic">
                    &quot;{liveTranscript}&quot;
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                <Check size={12} /> Concluir e Enviar
              </button>
            </div>
          </div>
        ) : isTranscribing ? (
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2 text-purple-300 text-xs font-mono animate-in fade-in duration-150">
            <Loader2 size={15} className="animate-spin text-purple-400" />
            <span>Transcrevendo fala com máxima fidelidade acústica...</span>
          </div>
        ) : (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              attachedImages.length > 0
                ? "Adicione uma instrução para a imagem ou clique em Consultar..."
                : "Pergunte em áudio/texto ou cole prints (Ctrl+V) sobre projetos e ideias..."
            }
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none"
          />
        )}

        <button
          type="submit"
          disabled={
            isLoading ||
            isRecording ||
            isTranscribing ||
            (!input.trim() && attachedImages.length === 0)
          }
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(147,51,234,0.4)] disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          <span>Consultar</span>
        </button>
      </form>
    </div>
  );
}
