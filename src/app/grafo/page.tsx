"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BrainCircuit,
  Folder,
  Lightbulb,
  FileText,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Idea, Project, MeetingDoc } from "@/types";

interface GraphNode {
  id: string;
  label: string;
  type: "core" | "project" | "idea" | "meeting";
  status?: string;
  department?: string;
  desc?: string;
  painPoint?: string;
  raw?: unknown;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  borderColor: string;
}

interface GraphEdge {
  source: string;
  target: string;
  color?: string;
}

export default function TriviumGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<"all" | "project" | "idea" | "meeting">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Visualização e Câmera
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const isDraggingNodeRef = useRef<GraphNode | null>(null);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Refs de animação
  const animationFrameRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  // Constrói o Grafo Relacional
  const buildGraph = useCallback((ideas: Idea[], projects: Project[], meetings: MeetingDoc[]) => {
    const width = 1200;
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];

    // 1. Nó Central: Trivium Hub
    newNodes.push({
      id: "trivium-core",
      label: "Trivium Hub",
      type: "core",
      desc: "Centro de Conhecimento e Inteligência Estratégica da Trivium.",
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: 40,
      color: "#9333ea",
      borderColor: "#d8b4fe",
    });

    // 2. Extrai projetos distintos
    const projectSet = new Set<string>();
    projects.forEach((p) => projectSet.add(p.name));
    ideas.forEach((i) => {
      if (i.project && i.project !== "Caixa de Entrada" && i.project !== "Geral") {
        projectSet.add(i.project);
      }
    });

    const projectNames = Array.from(projectSet);
    const projAngleStep = (Math.PI * 2) / Math.max(projectNames.length, 1);

    projectNames.forEach((pName, idx) => {
      const angle = idx * projAngleStep;
      const dist = 240 + (idx % 2) * 50;
      const pNodeId = `proj-${pName}`;
      const existingProj = projects.find((p) => p.name === pName);

      newNodes.push({
        id: pNodeId,
        label: pName,
        type: "project",
        status: existingProj?.status || "Backlog",
        department: existingProj?.department,
        painPoint: existingProj?.painPoint,
        raw: existingProj,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 28,
        color: "#2563eb",
        borderColor: "#93c5fd",
      });

      // Borda conectando Projeto ao Trivium Hub
      newEdges.push({
        source: "trivium-core",
        target: pNodeId,
        color: "rgba(59, 130, 246, 0.4)",
      });
    });

    // 3. Nós de Ideias conectados aos respectivos Projetos
    ideas.forEach((idea, idx) => {
      const parentProjName = idea.project;
      const targetProjId =
        parentProjName && projectSet.has(parentProjName)
          ? `proj-${parentProjName}`
          : "trivium-core";

      const angle = (idx * 0.7) % (Math.PI * 2);
      const dist = 380 + (idx % 3) * 60;

      const ideaNodeId = `idea-${idea.id || idx}`;
      newNodes.push({
        id: ideaNodeId,
        label: idea.title || (idea as unknown as { name?: string }).name || `Ideia #${idx + 1}`,
        type: "idea",
        status: idea.status || "Rascunho",
        department: idea.department,
        desc: idea.desc,
        painPoint: idea.painPoint,
        raw: idea,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 18,
        color:
          idea.status === "Aprovada"
            ? "#16a34a"
            : idea.status === "Sugestão da IA"
            ? "#f59e0b"
            : "#a855f7",
        borderColor: "#f3e8ff",
      });

      newEdges.push({
        source: targetProjId,
        target: ideaNodeId,
        color: "rgba(168, 85, 247, 0.25)",
      });
    });

    // 4. Nós de Reuniões conectados a projetos
    meetings.forEach((meet, idx) => {
      const targetProjId =
        meet.relatedProject && projectSet.has(meet.relatedProject)
          ? `proj-${meet.relatedProject}`
          : "trivium-core";

      const angle = (idx * 1.3) % (Math.PI * 2);
      const dist = 420;

      const meetNodeId = `meet-${meet.id || idx}`;
      newNodes.push({
        id: meetNodeId,
        label: meet.title || `Ata Reunião #${idx + 1}`,
        type: "meeting",
        desc: meet.meetingMinutes,
        raw: meet,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 18,
        color: "#059669",
        borderColor: "#a7f3d0",
      });

      newEdges.push({
        source: targetProjId,
        target: meetNodeId,
        color: "rgba(16, 185, 129, 0.3)",
      });
    });

    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    setNodes(newNodes);
  }, []);

  // Carrega dados do Firestore
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const loadGraphData = () => {
      // 1. Escuta Ideias
      const ideasUnsub = onSnapshot(query(collection(db, "ideas")), (ideaSnap) => {
        const ideasData = ideaSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Idea[];

        // 2. Escuta Projetos
        const projUnsub = onSnapshot(query(collection(db, "projects")), (projSnap) => {
          const projectsData = projSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Project[];

          // 3. Escuta Reuniões
          const meetUnsub = onSnapshot(query(collection(db, "meetings")), (meetSnap) => {
            const meetingsData = meetSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as MeetingDoc[];

            // Constrói o Grafo Relacional
            buildGraph(ideasData, projectsData, meetingsData);
          });
          unsubs.push(meetUnsub);
        });
        unsubs.push(projUnsub);
      });
      unsubs.push(ideasUnsub);
    };

    loadGraphData();
    return () => unsubs.forEach((unsub) => unsub());
  }, [buildGraph]);

  // Simulação física de forças suave e orgânica
  const tickPhysics = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    if (currentNodes.length === 0) return;

    // Força de repulsão entre nós
    for (let i = 0; i < currentNodes.length; i++) {
      for (let j = i + 1; j < currentNodes.length; j++) {
        const a = currentNodes[i];
        const b = currentNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dy + dy * dy) || 1;
        const minDist = a.radius + b.radius + 50;

        if (dist < minDist) {
          const force = (minDist - dist) / dist * 0.08;
          if (a.id !== "trivium-core" && a !== isDraggingNodeRef.current) {
            a.vx -= dx * force;
            a.vy -= dy * force;
          }
          if (b.id !== "trivium-core" && b !== isDraggingNodeRef.current) {
            b.vx += dx * force;
            b.vy += dy * force;
          }
        }
      }
    }

    // Força de atração por arestas (Spring)
    const nodeMap = new Map<string, GraphNode>();
    currentNodes.forEach((n) => nodeMap.set(n.id, n));

    currentEdges.forEach((edge) => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = src.id === "trivium-core" ? 220 : 130;
      const force = (dist - targetDist) * 0.003;

      if (src.id !== "trivium-core" && src !== isDraggingNodeRef.current) {
        src.vx += dx * force;
        src.vy += dy * force;
      }
      if (tgt.id !== "trivium-core" && tgt !== isDraggingNodeRef.current) {
        tgt.vx -= dx * force;
        tgt.vy -= dy * force;
      }
    });

    // Atualiza posições com amortecimento (friction)
    currentNodes.forEach((node) => {
      if (node.id === "trivium-core" || node === isDraggingNodeRef.current) return;
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.88;
      node.vy *= 0.88;
    });
  }, []);

  // Render loop do Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Fundo espacial profundo
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    // Grade sutil estelar
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Mapeamento de nós
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const nodeMap = new Map<string, GraphNode>();
    currentNodes.forEach((n) => nodeMap.set(n.id, n));

    // 1. Desenha arestas (Edges)
    currentEdges.forEach((edge) => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      const isSrcFiltered = filterType !== "all" && src.type !== filterType && src.type !== "core";
      const isTgtFiltered = filterType !== "all" && tgt.type !== filterType && tgt.type !== "core";
      if (isSrcFiltered || isTgtFiltered) return;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = edge.color || "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    });

    // 2. Desenha nós (Nodes)
    currentNodes.forEach((node) => {
      if (filterType !== "all" && node.type !== filterType && node.type !== "core") {
        return;
      }

      const isSelected = selectedNode?.id === node.id;
      const labelText = node.label || "";
      const isMatchSearch =
        searchTerm.trim() !== "" &&
        labelText.toLowerCase().includes(searchTerm.toLowerCase());

      // Glow exterior se selecionado ou buscando
      if (isSelected || isMatchSearch) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "rgba(168, 85, 247, 0.3)" : "rgba(234, 179, 8, 0.3)";
        ctx.fill();
      }

      // Corpo do Nó
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeStyle = isSelected ? "#ffffff" : node.borderColor;
      ctx.stroke();

      // Label do Nó
      ctx.font = `${node.type === "core" ? "bold 13px" : "11px"} Inter, system-ui, sans-serif`;
      ctx.fillStyle = isMatchSearch ? "#fef08a" : "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxLabelLen = node.type === "core" ? 20 : 16;
      const displayLabel =
        labelText.length > maxLabelLen
          ? labelText.slice(0, maxLabelLen) + "..."
          : labelText;

      ctx.fillText(displayLabel, node.x, node.y + node.radius + 14);
    });

    ctx.restore();
    ctx.restore();
  }, [pan, zoom, selectedNode, filterType, searchTerm]);

  // Loop de animação contínuo
  useEffect(() => {
    const loop = () => {
      tickPhysics();
      renderCanvas();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [tickPhysics, renderCanvas]);

  // Redimensionamento do canvas
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      renderCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  // Converte tela para mundo
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Mouse e Interações
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    // Verifica se clicou em algum nó
    const clickedNode = nodesRef.current.find((n) => {
      if (filterType !== "all" && n.type !== filterType && n.type !== "core") return false;
      const dx = n.x - worldPoint.x;
      const dy = n.y - worldPoint.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 5;
    });

    if (clickedNode) {
      isDraggingNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingNodeRef.current) {
      const worldPoint = screenToWorld(e.clientX, e.clientY);
      isDraggingNodeRef.current.x = worldPoint.x;
      isDraggingNodeRef.current.y = worldPoint.y;
      isDraggingNodeRef.current.vx = 0;
      isDraggingNodeRef.current.vy = 0;
      return;
    }

    if (isPanningRef.current) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingNodeRef.current = null;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.2), 3);

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const resetView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setPan({ x: rect.width / 2 - 600, y: rect.height / 2 - 400 });
    setZoom(1);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-950 text-white select-none"
    >
      {/* Top Header & Controles do Grafo */}
      <header className="absolute top-6 left-6 right-6 z-30 flex flex-wrap justify-between items-center gap-4 pointer-events-none">
        <div className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white">
            <BrainCircuit size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight flex items-center gap-2">
              Trivium Graph <Sparkles size={14} className="text-purple-400" />
            </h1>
            <p className="text-[11px] text-white/50">Mapa mental relacional de projetos, ideias e atas</p>
          </div>
        </div>

        {/* Barra de Filtros & Pesquisa */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-neutral-900/90 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-1.5 px-2 text-white/40">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar nós..."
              className="bg-transparent text-xs text-white placeholder:text-white/30 outline-none w-28 sm:w-40"
            />
          </div>

          <div className="flex items-center gap-1 bg-neutral-900/90 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-2xl text-xs">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                filterType === "all" ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              Todos ({nodes.length})
            </button>
            <button
              onClick={() => setFilterType("project")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                filterType === "project" ? "bg-blue-600/30 text-blue-300" : "text-white/50 hover:text-white"
              }`}
            >
              <Folder size={12} /> Projetos
            </button>
            <button
              onClick={() => setFilterType("idea")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                filterType === "idea" ? "bg-purple-600/30 text-purple-300" : "text-white/50 hover:text-white"
              }`}
            >
              <Lightbulb size={12} /> Ideias
            </button>
            <button
              onClick={() => setFilterType("meeting")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                filterType === "meeting" ? "bg-emerald-600/30 text-emerald-300" : "text-white/50 hover:text-white"
              }`}
            >
              <FileText size={12} /> Atas
            </button>
          </div>
        </div>
      </header>

      {/* Widget de Zoom & Reset */}
      <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/90 backdrop-blur-md border border-white/10 shadow-2xl text-white">
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.2))}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="px-2 text-xs font-semibold text-purple-300">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 3))}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <div className="h-4 w-px bg-white/10" />
        <button
          onClick={resetView}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Centralizar Câmera"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Canvas Principal */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Drawer Lateral de Detalhes do Nó Clicado */}
      {selectedNode && (
        <aside className="absolute top-6 bottom-6 right-6 w-96 z-40 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-3xl p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
          <div className="flex justify-between items-start mb-4">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border"
              style={{
                backgroundColor: `${selectedNode.color}20`,
                borderColor: `${selectedNode.color}60`,
                color: selectedNode.borderColor,
              }}
            >
              {selectedNode.type === "core"
                ? "Nó Central"
                : selectedNode.type === "project"
                ? "Projeto Trivium"
                : selectedNode.type === "idea"
                ? "Ideia / Feature"
                : "Ata de Reunião"}
            </span>

            <button
              onClick={() => setSelectedNode(null)}
              className="text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <h2 className="text-xl font-bold mb-2 text-white">{selectedNode.label}</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {selectedNode.status && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white/80">
                Status: {selectedNode.status}
              </span>
            )}
            {selectedNode.department && (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300">
                {selectedNode.department}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm text-white/70">
            {selectedNode.painPoint && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <h4 className="text-xs font-semibold uppercase text-red-300 mb-1">Dor / Problema</h4>
                <p className="text-xs leading-relaxed text-red-100/90">{selectedNode.painPoint}</p>
              </div>
            )}

            {selectedNode.desc && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-white/50 mb-1">Descrição / Contexto</h4>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{selectedNode.desc}</p>
              </div>
            )}
          </div>

          {selectedNode.type === "project" && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link
                href={`/projetos/${encodeURIComponent(selectedNode.label)}`}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                Abrir Painel do Projeto <ExternalLink size={14} />
              </Link>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
