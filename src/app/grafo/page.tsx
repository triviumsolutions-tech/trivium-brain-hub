"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BrainCircuit,
  Folder,
  Lightbulb,
  FileText,
  Search,
  ZoomIn,
  ZoomOut,
  X,
  ExternalLink,
  ArrowRight,
  Compass,
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
  pulseColor?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  color?: string;
  pulseColor?: string;
}

export default function TriviumGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dados brutos do Firestore
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allMeetings, setAllMeetings] = useState<MeetingDoc[]>([]);

  // Estado do Grafo
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<"all" | "project" | "idea" | "meeting">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Câmera & Visualização
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const isDraggingNodeRef = useRef<GraphNode | null>(null);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasCenteredInitiallyRef = useRef<boolean>(false);

  // Refs para loop de renderização a 60fps
  const animationFrameRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const selectedNodeRef = useRef<GraphNode | null>(null);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const filterTypeRef = useRef<"all" | "project" | "idea" | "meeting">("all");
  const searchTermRef = useRef<string>("");

  // Mantém refs sincronizadas para o loop de alta performance
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    selectedNodeRef.current = selectedNode;
    hoveredNodeRef.current = hoveredNode;
    panRef.current = pan;
    zoomRef.current = zoom;
    filterTypeRef.current = filterType;
    searchTermRef.current = searchTerm;
  }, [nodes, edges, selectedNode, hoveredNode, pan, zoom, filterType, searchTerm]);

  // Constrói nós e arestas com conexões neurais
  const buildGraph = useCallback(
    (ideas: Idea[], projects: Project[], meetings: MeetingDoc[]) => {
      const centerX = 600;
      const centerY = 450;

      const newNodes: GraphNode[] = [];
      const newEdges: GraphEdge[] = [];

      // 1. Nó Central: Trivium Hub (Núcleo)
      newNodes.push({
        id: "trivium-core",
        label: "Trivium Hub",
        type: "core",
        desc: "Núcleo neural de inteligência estratégica, inovação e projetos da Trivium.",
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: 46,
        color: "#7e22ce",
        borderColor: "#c084fc",
        pulseColor: "#a855f7",
      });

      // 2. Extrai projetos distintos
      const projectSet = new Set<string>();
      projects.forEach((p) => {
        if (p.name) projectSet.add(p.name);
      });
      ideas.forEach((i) => {
        if (i.project && i.project !== "Caixa de Entrada" && i.project !== "Geral") {
          projectSet.add(i.project);
        }
      });

      const projectNames = Array.from(projectSet);
      const projAngleStep = (Math.PI * 2) / Math.max(projectNames.length, 1);

      projectNames.forEach((pName, idx) => {
        const angle = idx * projAngleStep;
        const dist = 260 + (idx % 2) * 50;
        const pNodeId = `proj-${pName}`;
        const existingProj = projects.find((p) => p.name === pName);

        newNodes.push({
          id: pNodeId,
          label: pName,
          type: "project",
          status: existingProj?.status || "Backlog",
          department: existingProj?.department || "Engenharia",
          painPoint: existingProj?.painPoint,
          raw: existingProj,
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
          vx: 0,
          vy: 0,
          radius: 32,
          color:
            existingProj?.status === "Desenvolvimento"
              ? "#0284c7"
              : existingProj?.status === "Finalizado"
              ? "#10b981"
              : "#2563eb",
          borderColor: "#38bdf8",
          pulseColor: "#00f5ff",
        });

        // Fio cibernético interligando Projeto ao Trivium Hub
        newEdges.push({
          source: "trivium-core",
          target: pNodeId,
          color: "rgba(56, 189, 248, 0.45)",
          pulseColor: "#38bdf8",
        });
      });

      // 3. Ideias conectadas aos seus respectivos Projetos (ou ao Hub se forem gerais)
      ideas.forEach((idea, idx) => {
        const parentProjName = idea.project;
        const targetProjId =
          parentProjName && projectSet.has(parentProjName)
            ? `proj-${parentProjName}`
            : "trivium-core";

        const angle = (idx * 0.75) % (Math.PI * 2);
        const dist = 390 + (idx % 3) * 60;
        const ideaNodeId = `idea-${idea.id || idx}`;

        newNodes.push({
          id: ideaNodeId,
          label: idea.title || `Ideia #${idx + 1}`,
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
          radius: 20,
          color:
            idea.status === "Aprovada"
              ? "#059669"
              : idea.status === "Sugestão da IA"
              ? "#d97706"
              : "#9333ea",
          borderColor: "#e9d5ff",
          pulseColor: "#c084fc",
        });

        // Fio interligando Ideia ao Projeto
        newEdges.push({
          source: targetProjId,
          target: ideaNodeId,
          color: "rgba(168, 85, 247, 0.35)",
          pulseColor: "#e879f9",
        });
      });

      // 4. Reuniões / Atas conectadas a projetos
      meetings.forEach((meet, idx) => {
        const targetProjId =
          meet.relatedProject && projectSet.has(meet.relatedProject)
            ? `proj-${meet.relatedProject}`
            : "trivium-core";

        const angle = (idx * 1.4) % (Math.PI * 2);
        const dist = 430 + (idx % 2) * 50;
        const meetNodeId = `meet-${meet.id || idx}`;

        newNodes.push({
          id: meetNodeId,
          label: meet.title || `Ata #${idx + 1}`,
          type: "meeting",
          desc: meet.meetingMinutes,
          raw: meet,
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
          vx: 0,
          vy: 0,
          radius: 20,
          color: "#0d9488",
          borderColor: "#5eead4",
          pulseColor: "#2dd4bf",
        });

        // Fio interligando Reunião ao Projeto
        newEdges.push({
          source: targetProjId,
          target: meetNodeId,
          color: "rgba(45, 212, 191, 0.4)",
          pulseColor: "#2dd4bf",
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    },
    []
  );

  // Escuta dados do Firestore em tempo real
  useEffect(() => {
    let latestIdeas: Idea[] = [];
    let latestProjects: Project[] = [];
    let latestMeetings: MeetingDoc[] = [];

    const handleUpdate = () => {
      buildGraph(latestIdeas, latestProjects, latestMeetings);
    };

    const unsubIdeas = onSnapshot(collection(db, "ideas"), (snap) => {
      latestIdeas = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Idea[];
      setAllIdeas(latestIdeas);
      handleUpdate();
    });

    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      latestProjects = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Project[];
      setAllProjects(latestProjects);
      handleUpdate();
    });

    const unsubMeetings = onSnapshot(collection(db, "meetings"), (snap) => {
      latestMeetings = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MeetingDoc[];
      setAllMeetings(latestMeetings);
      handleUpdate();
    });

    return () => {
      unsubIdeas();
      unsubProjects();
      unsubMeetings();
    };
  }, [buildGraph]);

  // Centraliza câmera no Hub inicial
  useEffect(() => {
    if (!hasCenteredInitiallyRef.current && nodes.length > 0 && containerRef.current) {
      hasCenteredInitiallyRef.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: rect.width / 2 - 600,
        y: rect.height / 2 - 450,
      });
      setZoom(1);
    }
  }, [nodes]);

  // Simulação física orgânica de forças (Spring & Repulsion)
  const tickPhysics = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    if (currentNodes.length === 0) return;

    // Repulsão entre nós
    for (let i = 0; i < currentNodes.length; i++) {
      for (let j = i + 1; j < currentNodes.length; j++) {
        const a = currentNodes[i];
        const b = currentNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.radius + b.radius + 60;

        if (dist < minDist) {
          const force = ((minDist - dist) / dist) * 0.08;
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

    // Atração elástica pelas arestas
    const nodeMap = new Map<string, GraphNode>();
    currentNodes.forEach((n) => nodeMap.set(n.id, n));

    currentEdges.forEach((edge) => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = src.id === "trivium-core" ? 240 : 140;
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

    // Amortecimento
    currentNodes.forEach((node) => {
      if (node.id === "trivium-core" || node === isDraggingNodeRef.current) return;
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.88;
      node.vy *= 0.88;
    });
  }, []);

  // Renderização Futurista e Cibernética em Canvas 2D
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

    // 1. Fundo Espacial Profundo
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, width, height);

    const currentPan = panRef.current;
    const currentZoom = zoomRef.current;
    const currentSelected = selectedNodeRef.current;
    const currentHovered = hoveredNodeRef.current;
    const currentFilter = filterTypeRef.current;
    const currentSearch = searchTermRef.current;

    // Tempo para animação de pulso e rotações
    const time = performance.now() / 1000;

    // 2. Grade Cibernética Estelar Dinâmica
    ctx.save();
    ctx.translate(currentPan.x, currentPan.y);
    ctx.scale(currentZoom, currentZoom);

    // Grid de pontos neurais no fundo
    const gridSize = 80;
    const startX = Math.floor((-currentPan.x / currentZoom) / gridSize) * gridSize - gridSize;
    const endX = startX + (width / currentZoom) + gridSize * 2;
    const startY = Math.floor((-currentPan.y / currentZoom) / gridSize) * gridSize - gridSize;
    const endY = startY + (height / currentZoom) + gridSize * 2;

    ctx.fillStyle = "rgba(147, 197, 253, 0.05)";
    for (let gx = startX; gx < endX; gx += gridSize) {
      for (let gy = startY; gy < endY; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const nodeMap = new Map<string, GraphNode>();
    currentNodes.forEach((n) => nodeMap.set(n.id, n));

    // Determina se há nó com foco ativo
    const activeFocusNode = currentSelected || currentHovered;

    // 3. DESENHO DOS FIOS CIBERNÉTICOS (EDGES / SINAPSES COM FÓTONS DE ENERGIA)
    currentEdges.forEach((edge) => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      // Filtro ativo
      const isSrcFiltered =
        currentFilter !== "all" && src.type !== currentFilter && src.type !== "core";
      const isTgtFiltered =
        currentFilter !== "all" && tgt.type !== currentFilter && tgt.type !== "core";
      if (isSrcFiltered && isTgtFiltered) return;

      // Verifica se a aresta está conectada ao nó com foco
      const isConnectedToFocus =
        activeFocusNode &&
        (edge.source === activeFocusNode.id || edge.target === activeFocusNode.id);

      ctx.save();

      // Borda Externa / Fio Neon
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (isConnectedToFocus) {
        // Fio ATIVO em alta energia
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3.5 / currentZoom;
        ctx.shadowColor = "#00f5ff";
        ctx.shadowBlur = 18;
      } else if (activeFocusNode) {
        // Fio sem foco esmaecido
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1 / currentZoom;
        ctx.shadowBlur = 0;
      } else {
        // Fio em repouso
        ctx.strokeStyle = edge.color || "rgba(147, 51, 234, 0.35)";
        ctx.lineWidth = 1.8 / currentZoom;
        ctx.shadowColor = edge.pulseColor || "#c084fc";
        ctx.shadowBlur = 6;
      }
      ctx.stroke();
      ctx.restore();

      // FÓTONS DE ENERGIA VIAJANDO PELO FIO (PULSOS DE DADOS)
      const numPhotons = isConnectedToFocus ? 3 : 2;
      const photonSpeed = isConnectedToFocus ? 0.7 : 0.28;

      for (let p = 0; p < numPhotons; p++) {
        const offset = p / numPhotons;
        const progress = (time * photonSpeed + offset) % 1;
        const px = src.x + (tgt.x - src.x) * progress;
        const py = src.y + (tgt.y - src.y) * progress;

        ctx.save();
        ctx.beginPath();
        const pRadius = (isConnectedToFocus ? 3.5 : 2.2) / currentZoom;
        ctx.arc(px, py, pRadius, 0, Math.PI * 2);
        ctx.fillStyle = isConnectedToFocus ? "#00f5ff" : edge.pulseColor || "#c084fc";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
      }
    });

    // 4. DESENHO DOS NÓS (HOLOGRÁFICOS E CIBERNÉTICOS)
    currentNodes.forEach((node) => {
      const isNodeFiltered =
        currentFilter !== "all" && node.type !== currentFilter && node.type !== "core";
      if (isNodeFiltered) return;

      const isSelected = currentSelected?.id === node.id;
      const isHovered = currentHovered?.id === node.id;
      const labelText = node.label || "";
      const isMatchSearch =
        currentSearch.trim() !== "" &&
        labelText.toLowerCase().includes(currentSearch.toLowerCase());

      const isConnectedToFocus =
        activeFocusNode &&
        (node.id === activeFocusNode.id ||
          currentEdges.some(
            (e) =>
              (e.source === activeFocusNode.id && e.target === node.id) ||
              (e.target === activeFocusNode.id && e.source === node.id)
          ));

      const isDimmed = activeFocusNode && !isConnectedToFocus;

      ctx.save();
      if (isDimmed) {
        ctx.globalAlpha = 0.22;
      }

      // Efeito de Sonar / Pulso no Trivium Hub
      if (node.type === "core") {
        const pulseSize = node.radius + ((time * 25) % 45);
        const pulseAlpha = 1 - ((time * 25) % 45) / 45;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(192, 132, 252, ${pulseAlpha * 0.45})`;
        ctx.lineWidth = 2 / currentZoom;
        ctx.stroke();

        // Anel orbital tracejado rotativo
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(time * 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, node.radius + 14, 0, Math.PI * 2);
        ctx.setLineDash([8, 10]);
        ctx.strokeStyle = "rgba(192, 132, 252, 0.5)";
        ctx.lineWidth = 1.5 / currentZoom;
        ctx.stroke();
        ctx.restore();
      }

      // Anel de Aura em Projetos
      if (node.type === "project") {
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(-time * 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, node.radius + 8, 0, Math.PI * 2);
        ctx.setLineDash([4, 14]);
        ctx.strokeStyle = `${node.borderColor}80`;
        ctx.lineWidth = 1.5 / currentZoom;
        ctx.stroke();
        ctx.restore();
      }

      // Glow exterior se selecionado ou buscando
      if (isSelected || isHovered || isMatchSearch) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 12, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? "rgba(56, 189, 248, 0.35)"
          : "rgba(168, 85, 247, 0.3)";
        ctx.fill();
      }

      // Corpo Central do Nó (Gradiente Radial)
      const grad = ctx.createRadialGradient(
        node.x - node.radius * 0.3,
        node.y - node.radius * 0.3,
        node.radius * 0.1,
        node.x,
        node.y,
        node.radius
      );
      grad.addColorStop(0, node.borderColor);
      grad.addColorStop(1, node.color);

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Borda Neon
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.strokeStyle = isSelected ? "#ffffff" : node.borderColor;
      ctx.shadowColor = node.pulseColor || node.borderColor;
      ctx.shadowBlur = isSelected ? 20 : 10;
      ctx.stroke();

      // Ícone ou Marca no Centro
      if (node.type === "core") {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("TB", node.x, node.y);
      }

      // Label do Nó (Tipografia Moderna)
      ctx.shadowBlur = 0;
      ctx.font = `${
        node.type === "core" ? "bold 13px" : "600 11px"
      } Inter, system-ui, sans-serif`;
      ctx.fillStyle = isMatchSearch ? "#fef08a" : isSelected ? "#ffffff" : "#e2e8f0";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxLabelLen = node.type === "core" ? 22 : 18;
      const displayLabel =
        labelText.length > maxLabelLen
          ? labelText.slice(0, maxLabelLen) + "..."
          : labelText;

      ctx.fillText(displayLabel, node.x, node.y + node.radius + 16);

      // Badge de Status em Projetos
      if (node.type === "project" && node.status) {
        ctx.font = "500 9px monospace";
        ctx.fillStyle =
          node.status === "Desenvolvimento"
            ? "#34d399"
            : node.status === "Finalizado"
            ? "#60a5fa"
            : "#cbd5e1";
        ctx.fillText(node.status.toUpperCase(), node.x, node.y + node.radius + 28);
      }

      ctx.restore();
    });

    ctx.restore();
    ctx.restore();
  }, []);

  // Loop de Animação 60fps
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

  // Converte coordenadas de tela para o mundo no Canvas
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return {
      x: (screenX - panRef.current.x) / zoomRef.current,
      y: (screenY - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // Vôo de Câmera Suave para um Nó
  const flyToNode = useCallback(
    (targetNode: GraphNode) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const screenW = canvas.width / dpr;
      const screenH = canvas.height / dpr;

      const targetZoom = targetNode.type === "core" ? 1 : 1.25;
      const targetPanX = screenW / 2 - targetNode.x * targetZoom;
      const targetPanY = screenH / 2 - targetNode.y * targetZoom;

      const startPanX = pan.x;
      const startPanY = pan.y;
      const startZoom = zoom;
      const startTime = performance.now();
      const duration = 500;

      const animateStep = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        setPan({
          x: startPanX + (targetPanX - startPanX) * ease,
          y: startPanY + (targetPanY - startPanY) * ease,
        });
        setZoom(startZoom + (targetZoom - startZoom) * ease);

        if (progress < 1) {
          requestAnimationFrame(animateStep);
        }
      };

      requestAnimationFrame(animateStep);
      setSelectedNode(targetNode);
    },
    [pan, zoom]
  );

  // Mouse e Interações
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    const clickedNode = nodesRef.current.find((n) => {
      if (filterType !== "all" && n.type !== filterType && n.type !== "core") return false;
      const dx = n.x - worldPoint.x;
      const dy = n.y - worldPoint.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
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
      return;
    }

    // Detecta hover
    const worldPoint = screenToWorld(e.clientX, e.clientY);
    const hovered = nodesRef.current.find((n) => {
      if (filterType !== "all" && n.type !== filterType && n.type !== "core") return false;
      const dx = n.x - worldPoint.x;
      const dy = n.y - worldPoint.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });
    setHoveredNode(hovered || null);
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
    const coreNode = nodes.find((n) => n.id === "trivium-core");
    if (coreNode) {
      flyToNode(coreNode);
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({ x: rect.width / 2 - 600, y: rect.height / 2 - 450 });
      setZoom(1);
    }
  };

  // Contagens para HUD
  const countProjects = useMemo(() => nodes.filter((n) => n.type === "project").length, [nodes]);
  const countIdeas = useMemo(() => nodes.filter((n) => n.type === "idea").length, [nodes]);
  const countMeetings = useMemo(() => nodes.filter((n) => n.type === "meeting").length, [nodes]);

  // Dados correlacionados para o Drawer Lateral
  const drawerConnectedData = useMemo(() => {
    if (!selectedNode) return null;

    if (selectedNode.type === "core") {
      return {
        projects: nodes.filter((n) => n.type === "project"),
        allProjects,
        ideas: allIdeas,
        meetings: allMeetings,
      };
    }

    if (selectedNode.type === "project") {
      const projIdeas = allIdeas.filter((i) => i.project === selectedNode.label);
      const projMeetings = allMeetings.filter((m) => m.relatedProject === selectedNode.label);
      const projRaw = selectedNode.raw as Project | undefined;
      return {
        ideas: projIdeas,
        meetings: projMeetings,
        tasks: projRaw?.tasks || [],
      };
    }

    if (selectedNode.type === "idea") {
      const ideaRaw = selectedNode.raw as Idea | undefined;
      const parentProjNode = nodes.find(
        (n) => n.type === "project" && n.label === ideaRaw?.project
      );
      return {
        parentProject: parentProjNode || null,
        parentProjectName: ideaRaw?.project || "Caixa de Entrada Geral",
      };
    }

    if (selectedNode.type === "meeting") {
      const meetRaw = selectedNode.raw as MeetingDoc | undefined;
      const relatedProjNode = nodes.find(
        (n) => n.type === "project" && n.label === meetRaw?.relatedProject
      );
      return {
        relatedProject: relatedProjNode || null,
        relatedProjectName: meetRaw?.relatedProject || "Geral",
        attendees: meetRaw?.attendees || [],
      };
    }

    return null;
  }, [selectedNode, nodes, allIdeas, allProjects, allMeetings]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-950 text-white select-none font-sans"
    >
      {/* Top Header & HUD Futurista */}
      <header className="absolute top-6 left-6 right-6 z-30 flex flex-wrap justify-between items-center gap-4 pointer-events-none">
        <div className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-[0_0_25px_rgba(0,0,0,0.5)] pointer-events-auto">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]">
            <BrainCircuit size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                Trivium Graph
              </h1>
              <span className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                NEURAL LINK
              </span>
            </div>
            <p className="text-[11px] text-white/50">
              {nodes.length} nós • {edges.length} sinapses ativas interligadas
            </p>
          </div>
        </div>

        {/* Barra de Filtros & Busca Holográfica */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-neutral-900/90 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl border border-white/10 shadow-2xl">
            <Search size={14} className="text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar sinapses..."
              className="bg-transparent text-xs text-white placeholder:text-white/30 outline-none w-28 sm:w-44"
            />
          </div>

          <div className="flex items-center gap-1 bg-neutral-900/90 backdrop-blur-xl p-1 rounded-2xl border border-white/10 shadow-2xl text-xs">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                filterType === "all"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Todos ({nodes.length})
            </button>
            <button
              onClick={() => setFilterType("project")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                filterType === "project"
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Folder size={12} /> Projetos ({countProjects})
            </button>
            <button
              onClick={() => setFilterType("idea")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                filterType === "idea"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Lightbulb size={12} /> Ideias ({countIdeas})
            </button>
            <button
              onClick={() => setFilterType("meeting")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                filterType === "meeting"
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <FileText size={12} /> Atas ({countMeetings})
            </button>
          </div>
        </div>
      </header>

      {/* Widget de Zoom & Centralizar */}
      <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/90 backdrop-blur-xl border border-white/10 shadow-2xl text-white">
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.2))}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Diminuir Zoom"
        >
          <ZoomOut size={16} />
        </button>
        <span className="px-2 text-xs font-mono font-bold text-purple-300">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 3))}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Aumentar Zoom"
        >
          <ZoomIn size={16} />
        </button>
        <div className="h-4 w-px bg-white/10" />
        <button
          onClick={resetView}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          title="Centralizar Câmera no Trivium Hub"
        >
          <Compass size={15} className="text-purple-400" />
          <span>Centralizar</span>
        </button>
      </div>

      {/* Dica de navegação no canto inferior esquerdo */}
      <div className="absolute bottom-6 left-6 z-30 hidden sm:flex items-center gap-3 text-[11px] font-mono text-white/40 bg-neutral-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/5">
        <span>Arraste para mover câmera</span>
        <span>•</span>
        <span>Scroll para zoom</span>
        <span>•</span>
        <span>Clique nos nós para inspecionar conexões</span>
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

      {/* DRAWER LATERAL DE ALTA FIDELIDADE: CONEXÕES & RELACIONAMENTOS */}
      {selectedNode && (
        <aside className="absolute top-6 bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] z-40 bg-neutral-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-right duration-250">
          {/* Header do Drawer */}
          <div className="flex justify-between items-start mb-3">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border shadow-sm"
              style={{
                backgroundColor: `${selectedNode.color}25`,
                borderColor: `${selectedNode.borderColor}80`,
                color: selectedNode.borderColor,
              }}
            >
              {selectedNode.type === "core"
                ? "Núcleo Central"
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

          <h2 className="text-xl font-extrabold mb-1 text-white tracking-tight leading-snug">
            {selectedNode.label}
          </h2>

          {/* Badges de Metadados */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {selectedNode.status && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-white/10 text-white/90 border border-white/10">
                {selectedNode.status}
              </span>
            )}
            {selectedNode.department && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {selectedNode.department}
              </span>
            )}
          </div>

          {/* CONTEÚDO ESPECÍFICO DE CONEXÕES */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-white/70">
            {/* 1. CASO SEJA O TRIVIUM HUB (CORE) */}
            {selectedNode.type === "core" && drawerConnectedData && (
              <div className="space-y-4">
                <p className="text-xs text-white/60 leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/5">
                  {selectedNode.desc}
                </p>

                {/* Métricas do Hub */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-center">
                    <span className="text-lg font-bold text-blue-300 block">
                      {drawerConnectedData.projects?.length || 0}
                    </span>
                    <span className="text-[10px] text-white/50 uppercase font-mono">Projetos</span>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-center">
                    <span className="text-lg font-bold text-purple-300 block">
                      {drawerConnectedData.ideas?.length || 0}
                    </span>
                    <span className="text-[10px] text-white/50 uppercase font-mono">Ideias</span>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center">
                    <span className="text-lg font-bold text-emerald-300 block">
                      {drawerConnectedData.meetings?.length || 0}
                    </span>
                    <span className="text-[10px] text-white/50 uppercase font-mono">Atas</span>
                  </div>
                </div>

                {/* Lista de Projetos que orbitam o Hub */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-2 flex items-center gap-1.5">
                    <Folder size={13} /> Projetos Orbitando o Hub
                  </h4>
                  {(!drawerConnectedData.projects ||
                    drawerConnectedData.projects.length === 0) ? (
                    <p className="text-white/40 italic">Nenhum projeto cadastrado ainda.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {drawerConnectedData.projects.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/40 flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="font-semibold text-white block text-xs">
                              {p.label}
                            </span>
                            <span className="text-[10px] text-white/40 font-mono">
                              Status: {p.status || "Backlog"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => flyToNode(p)}
                            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10"
                          >
                            Focar no nó <ArrowRight size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. CASO SEJA UM PROJETO */}
            {selectedNode.type === "project" && drawerConnectedData && (
              <div className="space-y-4">
                {selectedNode.painPoint && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase text-red-300 mb-1">
                      Dor / Problema do Cliente
                    </h4>
                    <p className="text-xs leading-relaxed text-red-100/90">
                      {selectedNode.painPoint}
                    </p>
                  </div>
                )}

                {/* Ideias Conectadas a este Projeto */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2 flex items-center gap-1.5">
                    <Lightbulb size={13} /> Ideias Conectadas ({drawerConnectedData.ideas?.length || 0})
                  </h4>
                  {(!drawerConnectedData.ideas || drawerConnectedData.ideas.length === 0) ? (
                    <p className="text-white/40 text-xs italic bg-white/5 p-3 rounded-xl border border-white/5">
                      Nenhuma ideia vinculada diretamente a este projeto ainda. Crie ideias apontando para ele na Home!
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {drawerConnectedData.ideas.map((idea) => {
                        const ideaNode = nodes.find(
                          (n) => n.id === `idea-${idea.id}` || n.label === idea.title
                        );

                        return (
                          <div
                            key={idea.id || idea.title}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between hover:border-purple-500/40 transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="font-semibold text-white block text-xs truncate">
                                {idea.title}
                              </span>
                              <span className="text-[10px] text-purple-400 font-mono">
                                {idea.status || "Rascunho"}
                              </span>
                            </div>
                            {ideaNode && (
                              <button
                                type="button"
                                onClick={() => flyToNode(ideaNode)}
                                className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 px-2 py-1 rounded bg-purple-500/10 shrink-0"
                              >
                                Focar nó
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Atas e Reuniões Vinculadas */}
                {drawerConnectedData.meetings && drawerConnectedData.meetings.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2 flex items-center gap-1.5">
                      <FileText size={13} /> Atas & Reuniões ({drawerConnectedData.meetings.length})
                    </h4>
                    <div className="space-y-1.5">
                      {drawerConnectedData.meetings.map((meet) => (
                        <div
                          key={meet.id || meet.title}
                          className="p-2.5 rounded-xl bg-white/5 border border-white/5"
                        >
                          <span className="font-semibold text-white block text-xs truncate">
                            {meet.title}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {meet.scheduledAt
                              ? new Date(meet.scheduledAt).toLocaleDateString()
                              : "Sem data"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. CASO SEJA UMA IDEIA */}
            {selectedNode.type === "idea" && (
              <div className="space-y-4">
                {/* Projeto Pai Vinculado */}
                {drawerConnectedData?.parentProjectName && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-blue-300 uppercase font-mono block">
                        Projeto Vinculado
                      </span>
                      <span className="text-xs font-bold text-white">
                        {drawerConnectedData.parentProjectName}
                      </span>
                    </div>
                    {drawerConnectedData.parentProject && (
                      <button
                        type="button"
                        onClick={() => flyToNode(drawerConnectedData.parentProject!)}
                        className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        Ver Projeto <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                )}

                {selectedNode.painPoint && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase text-red-300 mb-1">
                      Dor do Cliente
                    </h4>
                    <p className="text-xs leading-relaxed text-red-100/90">
                      {selectedNode.painPoint}
                    </p>
                  </div>
                )}

                {selectedNode.desc && (
                  <div>
                    <h4 className="text-xs font-bold uppercase text-white/50 mb-1">
                      Descrição & Contexto
                    </h4>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap bg-white/5 p-3 rounded-2xl border border-white/5">
                      {selectedNode.desc}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 4. CASO SEJA UMA REUNIÃO / ATA */}
            {selectedNode.type === "meeting" && (
              <div className="space-y-4">
                {drawerConnectedData?.relatedProjectName && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-blue-300 uppercase font-mono block">
                        Projeto da Reunião
                      </span>
                      <span className="text-xs font-bold text-white">
                        {drawerConnectedData.relatedProjectName}
                      </span>
                    </div>
                    {drawerConnectedData.relatedProject && (
                      <button
                        type="button"
                        onClick={() => flyToNode(drawerConnectedData.relatedProject!)}
                        className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        Ver Projeto <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                )}

                {drawerConnectedData?.attendees && drawerConnectedData.attendees.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase text-emerald-300 mb-1.5">
                      Participantes
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {drawerConnectedData.attendees.map((email: string) => (
                        <span
                          key={email}
                          className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono"
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.desc && (
                  <div>
                    <h4 className="text-xs font-bold uppercase text-white/50 mb-1">
                      Ata / Pauta Registrada
                    </h4>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap bg-white/5 p-3 rounded-2xl border border-white/5">
                      {selectedNode.desc}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rodapé com Ações do Drawer */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
            {selectedNode.type === "project" && (
              <Link
                href={`/projetos/${encodeURIComponent(selectedNode.label)}`}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                Abrir Painel & Kanban do Projeto <ExternalLink size={14} />
              </Link>
            )}

            <button
              type="button"
              onClick={() => flyToNode(selectedNode)}
              className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-white/10"
            >
              <Compass size={14} className="text-purple-400" /> Focar Câmera Neste Nó
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
