"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eraser,
  Hand,
  Pencil,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Lock,
  Square,
  Type,
  StickyNote,
  X,
  Check,
} from "lucide-react";

export interface Point {
  x: number;
  y: number;
}

export type WhiteboardItemType = "stroke" | "rect" | "text" | "sticky";

export interface WhiteboardElement {
  id: string;
  type?: WhiteboardItemType;
  // Para traços livres:
  points?: Point[];
  // Para blocos retangulares, post-its e texto:
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color: string;
  strokeWidth?: number;
  fillColor?: string;
  isEraser?: boolean;
}

export type ToolType = "pencil" | "rect" | "text" | "sticky" | "eraser" | "hand";

const STROKE_WIDTHS = [
  { label: "Fino", value: 2 },
  { label: "Médio", value: 4 },
  { label: "Grosso", value: 8 },
  { label: "Marcador", value: 14 },
];

const FONT_SIZES = [
  { label: "P", value: 16 },
  { label: "M", value: 22 },
  { label: "G", value: 30 },
  { label: "GG", value: 44 },
];

const PRESET_COLORS = [
  { name: "Preto", value: "#0f172a" },
  { name: "Roxo", value: "#9333ea" },
  { name: "Azul", value: "#2563eb" },
  { name: "Verde", value: "#16a34a" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Laranja", value: "#ea580c" },
  { name: "Vermelho", value: "#dc2626" },
];

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, curY);
      line = words[n] + " ";
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}

function parseInitialData(initialData?: string) {
  if (!initialData) {
    return { elements: [], pan: { x: 0, y: 0 }, zoom: 1, bgImage: null };
  }
  try {
    if (initialData.startsWith("{") && (initialData.includes("strokes") || initialData.includes("elements"))) {
      const parsed = JSON.parse(initialData);
      const rawList = Array.isArray(parsed.elements)
        ? parsed.elements
        : Array.isArray(parsed.strokes)
        ? parsed.strokes
        : [];

      return {
        elements: rawList as WhiteboardElement[],
        pan:
          parsed.pan && typeof parsed.pan.x === "number"
            ? parsed.pan
            : { x: 0, y: 0 },
        zoom:
          parsed.zoom && typeof parsed.zoom === "number" ? parsed.zoom : 1,
        bgImage: parsed.bgImage || null,
      };
    }
  } catch {
    // fallback
  }

  if (initialData.startsWith("data:image/")) {
    return { elements: [], pan: { x: 0, y: 0 }, zoom: 1, bgImage: initialData };
  }

  return { elements: [], pan: { x: 0, y: 0 }, zoom: 1, bgImage: null };
}

export function Whiteboard({
  initialData,
  onSave,
  readOnly = false,
}: {
  initialData?: string;
  onSave?: (data: string) => void;
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Inicialização única
  const [initialConfig] = useState(() => parseInitialData(initialData));

  // Navegação Infinite Canvas
  const [pan, setPan] = useState<{ x: number; y: number }>(initialConfig.pan);
  const [zoom, setZoom] = useState<number>(initialConfig.zoom);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ferramentas ativas
  const [activeTool, setActiveTool] = useState<ToolType>("pencil");
  const [color, setColor] = useState<string>("#0f172a");
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [fontSize, setFontSize] = useState<number>(22);

  // Elementos e Histórico
  const [elements, setElements] = useState<WhiteboardElement[]>(initialConfig.elements);
  const [activeDrawing, setActiveDrawing] = useState<WhiteboardElement | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(initialConfig.elements.length > 0);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const undoStackRef = useRef<WhiteboardElement[][]>([]);
  const redoStackRef = useRef<WhiteboardElement[][]>([]);

  // Caixa de entrada de texto interativa
  const [textModal, setTextModal] = useState<{
    worldX: number;
    worldY: number;
    type: "text" | "sticky";
    initialText: string;
  } | null>(null);
  const [textInputVal, setTextInputVal] = useState("");

  // Retângulo sendo arrastado
  const rectStartRef = useRef<Point | null>(null);

  // Imagem legada de fundo
  const bgImageElementRef = useRef<HTMLImageElement | null>(null);
  const legacyBgDataRef = useRef<string | null>(initialConfig.bgImage);

  // Transforma coordenadas da tela para o mundo virtual
  const screenToWorld = useCallback(
    (screenX: number, screenY: number, curPan = pan, curZoom = zoom): Point => {
      return {
        x: (screenX - curPan.x) / curZoom,
        y: (screenY - curPan.y) / curZoom,
      };
    },
    [pan, zoom]
  );

  // Renderiza um único elemento no Canvas
  const renderSingleElement = (ctx: CanvasRenderingContext2D, el: WhiteboardElement) => {
    ctx.save();

    if (el.type === "rect") {
      const rx = el.x || 0;
      const ry = el.y || 0;
      const rw = el.width || 120;
      const rh = el.height || 70;
      const radius = 8;

      ctx.beginPath();
      // Compatibilidade com navegadores mais antigos
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(rx, ry, rw, rh, radius);
      } else {
        ctx.rect(rx, ry, rw, rh);
      }
      ctx.fillStyle = el.fillColor || `${el.color}15`;
      ctx.fill();
      ctx.lineWidth = el.strokeWidth || 3;
      ctx.strokeStyle = el.color;
      ctx.stroke();

      if (el.text) {
        ctx.font = `600 ${el.fontSize || 16}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = el.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.text, rx + rw / 2, ry + rh / 2);
      }
    } else if (el.type === "sticky") {
      const sx = el.x || 0;
      const sy = el.y || 0;
      const sw = el.width || 170;
      const sh = el.height || 140;

      // Sombra realista de post-it
      ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;

      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(sx, sy, sw, sh, 6);
      } else {
        ctx.rect(sx, sy, sw, sh);
      }
      ctx.fillStyle = el.fillColor || "#fef08a"; // Amarelo clássico por padrão
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Linha superior sutil decorativa do post-it
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(sx, sy, sw, 14);

      if (el.text) {
        ctx.font = `500 ${el.fontSize || 15}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = "#1e293b";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        wrapText(ctx, el.text, sx + 14, sy + 24, sw - 28, 20);
      }
    } else if (el.type === "text") {
      const tx = el.x || 0;
      const ty = el.y || 0;
      ctx.font = `700 ${el.fontSize || 22}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = el.color || "#0f172a";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      if (el.text) {
        const lines = el.text.split("\n");
        const lineHeight = (el.fontSize || 22) * 1.3;
        lines.forEach((line, idx) => {
          ctx.fillText(line, tx, ty + idx * lineHeight);
        });
      }
    } else {
      // Traço Livre (Pencil / Eraser)
      if (!el.points || el.points.length === 0) return;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = el.strokeWidth || 4;
      ctx.strokeStyle = el.isEraser ? "#ffffff" : el.color;

      ctx.beginPath();
      if (el.points.length === 1) {
        ctx.arc(
          el.points[0].x,
          el.points[0].y,
          (el.strokeWidth || 4) / 2,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = el.isEraser ? "#ffffff" : el.color;
        ctx.fill();
      } else {
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Redesenho do Canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Fundo branco puro
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Grade de pontos (Dot Grid)
    const baseGrid = 30;
    const step = baseGrid * zoom;
    if (step >= 10) {
      const offsetX = ((pan.x % step) + step) % step;
      const offsetY = ((pan.y % step) + step) % step;
      ctx.fillStyle = "rgba(100, 116, 139, 0.25)";
      const dotSize = Math.max(1, Math.min(2, 1.2 * zoom));

      for (let x = offsetX; x < width; x += step) {
        for (let y = offsetY; y < height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3. Aplica transformação da câmera
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Fundo legado
    if (bgImageElementRef.current) {
      ctx.drawImage(bgImageElementRef.current, 0, 0);
    }

    // 4. Renderiza todos os elementos salvos
    for (const el of elements) {
      renderSingleElement(ctx, el);
    }

    // 5. Renderiza elemento ativo em construção
    if (activeDrawing) {
      renderSingleElement(ctx, activeDrawing);
    }

    ctx.restore();
    ctx.restore();
  }, [pan, zoom, elements, activeDrawing]);

  // Carrega imagem de fundo legada (se houver)
  useEffect(() => {
    if (!initialConfig.bgImage) return;
    const img = new Image();
    img.onload = () => {
      bgImageElementRef.current = img;
      redraw();
    };
    img.src = initialConfig.bgImage;
  }, [initialConfig.bgImage, redraw]);

  // Redimensionamento responsivo com Retina/DPR
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

      redraw();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Salva elementos no formato estruturado
  const triggerSave = useCallback(
    (newElements: WhiteboardElement[], currentPan = pan, currentZoom = zoom) => {
      if (!onSave) return;
      const payload = JSON.stringify({
        version: 3,
        strokes: newElements,
        elements: newElements,
        bgImage: legacyBgDataRef.current || undefined,
        pan: currentPan,
        zoom: currentZoom,
      });
      onSave(payload);
    },
    [onSave, pan, zoom]
  );

  // Desfazer (Undo)
  const handleUndo = useCallback(() => {
    if (elements.length === 0) return;
    const previousState = undoStackRef.current.pop();
    redoStackRef.current.push([...elements]);
    const nextElements = previousState || elements.slice(0, -1);
    setElements(nextElements);
    setCanUndo(undoStackRef.current.length > 0 || nextElements.length > 0);
    setCanRedo(true);
    triggerSave(nextElements);
  }, [elements, triggerSave]);

  // Refazer (Redo)
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const nextState = redoStackRef.current.pop();
    if (nextState) {
      undoStackRef.current.push([...elements]);
      setElements(nextState);
      setCanUndo(true);
      setCanRedo(redoStackRef.current.length > 0);
      triggerSave(nextState);
    }
  }, [elements, triggerSave]);

  // Limpar quadro
  const handleClear = useCallback(() => {
    if (elements.length === 0 && !bgImageElementRef.current) return;
    if (!window.confirm("Deseja realmente limpar todos os elementos do quadro?")) {
      return;
    }
    undoStackRef.current.push([...elements]);
    redoStackRef.current = [];
    setElements([]);
    legacyBgDataRef.current = null;
    bgImageElementRef.current = null;
    setCanUndo(true);
    setCanRedo(false);
    triggerSave([]);
  }, [elements, triggerSave]);

  // Centralizar visualização
  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    triggerSave(elements, { x: 0, y: 0 }, 1);
  }, [elements, triggerSave]);

  // Controle de Zoom
  const handleZoomChange = useCallback(
    (factor: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const newZoom = Math.min(Math.max(zoom * factor, 0.1), 5);
      const newPanX = centerX - (centerX - pan.x) * (newZoom / zoom);
      const newPanY = centerY - (centerY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
      triggerSave(elements, { x: newPanX, y: newPanY }, newZoom);
    },
    [zoom, pan, elements, triggerSave]
  );

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }

      if (e.key === "p" || e.key === "P") setActiveTool("pencil");
      if (e.key === "r" || e.key === "R") setActiveTool("rect");
      if (e.key === "t" || e.key === "T") setActiveTool("text");
      if (e.key === "s" || e.key === "S") setActiveTool("sticky");
      if (e.key === "e" || e.key === "E") setActiveTool("eraser");
      if (e.key === "h" || e.key === "H") setActiveTool("hand");

      if (e.key === "+" || e.key === "=") handleZoomChange(1.15);
      if (e.key === "-" || e.key === "_") handleZoomChange(0.85);
      if (e.key === "0") resetView();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleUndo, handleRedo, handleZoomChange, resetView]);

  // Zoom pelo Mouse Wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 5);

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Eventos de Mouse
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const isPanMode =
      activeTool === "hand" ||
      isSpacePressed ||
      e.button === 1 ||
      e.button === 2;

    if (isPanMode) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPoint = screenToWorld(clientX, clientY);

    // Inserção de Texto ou Post-it ao clicar
    if (activeTool === "text" || activeTool === "sticky") {
      setTextModal({
        worldX: worldPoint.x,
        worldY: worldPoint.y,
        type: activeTool,
        initialText: "",
      });
      setTextInputVal("");
      return;
    }

    // Desenhar Bloco Retangular
    if (activeTool === "rect") {
      rectStartRef.current = worldPoint;
      setActiveDrawing({
        id: `${Date.now()}-${Math.random()}`,
        type: "rect",
        x: worldPoint.x,
        y: worldPoint.y,
        width: 10,
        height: 10,
        color,
        strokeWidth,
        fillColor: `${color}15`,
      });
      return;
    }

    // Caneta ou Borracha
    const isEraser = activeTool === "eraser";
    const newElement: WhiteboardElement = {
      id: `${Date.now()}-${Math.random()}`,
      type: "stroke",
      points: [worldPoint],
      color,
      strokeWidth: isEraser ? strokeWidth * 4 : strokeWidth,
      isEraser,
    };

    setActiveDrawing(newElement);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPoint = screenToWorld(clientX, clientY);

    // Arraste de Retângulo
    if (activeTool === "rect" && rectStartRef.current && activeDrawing) {
      const start = rectStartRef.current;
      const minX = Math.min(start.x, worldPoint.x);
      const minY = Math.min(start.y, worldPoint.y);
      const width = Math.max(Math.abs(worldPoint.x - start.x), 20);
      const height = Math.max(Math.abs(worldPoint.y - start.y), 20);

      setActiveDrawing((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: minX,
          y: minY,
          width,
          height,
        };
      });
      return;
    }

    // Arraste de Caneta
    if (activeDrawing && activeDrawing.type === "stroke") {
      setActiveDrawing((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...(prev.points || []), worldPoint],
        };
      });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    rectStartRef.current = null;

    if (activeDrawing) {
      undoStackRef.current.push([...elements]);
      redoStackRef.current = [];
      const updatedElements = [...elements, activeDrawing];
      setElements(updatedElements);
      setCanUndo(true);
      setCanRedo(false);
      setActiveDrawing(null);
      triggerSave(updatedElements);
    }
  };

  // Submissão do Texto / Sticky Note
  const handleCommitText = () => {
    if (!textModal || !textInputVal.trim()) {
      setTextModal(null);
      return;
    }

    const isSticky = textModal.type === "sticky";
    const newEl: WhiteboardElement = {
      id: `${Date.now()}-${Math.random()}`,
      type: textModal.type,
      x: textModal.worldX,
      y: textModal.worldY,
      text: textInputVal.trim(),
      fontSize,
      color: isSticky ? "#1e293b" : color,
      fillColor: isSticky ? color : undefined,
      width: isSticky ? 180 : undefined,
      height: isSticky ? 140 : undefined,
    };

    undoStackRef.current.push([...elements]);
    redoStackRef.current = [];
    const updated = [...elements, newEl];
    setElements(updated);
    setCanUndo(true);
    setCanRedo(false);
    triggerSave(updated);

    setTextModal(null);
    setTextInputVal("");
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col select-none overflow-hidden bg-slate-900 rounded-2xl border border-white/10 shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Barra de Ferramentas Superior */}
      {readOnly ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-neutral-900/90 backdrop-blur-md border border-amber-500/40 shadow-2xl text-amber-300 text-xs font-semibold">
          <Lock size={15} className="text-amber-400" />
          <span>Quadro Congelado (Projeto Finalizado) • Documentação Técnica Histórica</span>
        </div>
      ) : (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-white/15 shadow-2xl text-white max-w-[95vw]">
          {/* Seletor de Ferramentas Principais */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setActiveTool("pencil")}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                activeTool === "pencil"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Caneta Livre (P)"
            >
              <Pencil size={15} />
              <span className="hidden md:inline">Caneta</span>
            </button>

            <button
              onClick={() => setActiveTool("rect")}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                activeTool === "rect"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Bloco / Arquitetura (R)"
            >
              <Square size={15} />
              <span className="hidden md:inline">Bloco</span>
            </button>

            <button
              onClick={() => setActiveTool("text")}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                activeTool === "text"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Texto (T)"
            >
              <Type size={15} />
              <span className="hidden md:inline">Texto</span>
            </button>

            <button
              onClick={() => setActiveTool("sticky")}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                activeTool === "sticky"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Nota Post-it (S)"
            >
              <StickyNote size={15} />
              <span className="hidden md:inline">Post-it</span>
            </button>

            <button
              onClick={() => setActiveTool("eraser")}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                activeTool === "eraser"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Borracha (E)"
            >
              <Eraser size={15} />
              <span className="hidden md:inline">Borracha</span>
            </button>

            <button
              onClick={() => setActiveTool("hand")}
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
                activeTool === "hand"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Mover Tela (H ou Espaço)"
            >
              <Hand size={15} />
              <span className="hidden md:inline">Mover</span>
            </button>
          </div>

          <div className="h-6 w-px bg-white/10" />

          {/* Tamanho da Fonte (quando em modo texto) ou Espessura (caneta/bloco) */}
          {activeTool === "text" || activeTool === "sticky" ? (
            <div className="flex items-center gap-1">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFontSize(f.value)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                    fontSize === f.value
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                  }`}
                  title={`Fonte ${f.label}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {STROKE_WIDTHS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setStrokeWidth(item.value)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    strokeWidth === item.value
                      ? "bg-white/20 text-white border border-white/30"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                  }`}
                  title={`Espessura: ${item.label}`}
                >
                  <span
                    className="rounded-full bg-current"
                    style={{ width: `${item.value + 2}px`, height: `${item.value + 2}px` }}
                  />
                </button>
              ))}
            </div>
          )}

          <div className="h-6 w-px bg-white/10" />

          {/* Cores rápidas */}
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setColor(c.value);
                  if (activeTool === "eraser") setActiveTool("pencil");
                }}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === c.value && activeTool !== "eraser"
                    ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}

            <label
              className="relative cursor-pointer flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-rose-500 via-emerald-500 to-sky-500 p-0.5 border border-white/20 hover:scale-105 transition-transform"
              title="Cor personalizada"
            >
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (activeTool === "eraser") setActiveTool("pencil");
                }}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
              />
            </label>
          </div>

          <div className="h-6 w-px bg-white/10" />

          {/* Desfazer / Refazer / Limpar */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo && elements.length === 0}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors ml-1"
              title="Limpar Todo o Quadro"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Popup para Inserir Texto ou Post-it */}
      {textModal && (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                {textModal.type === "sticky" ? <StickyNote size={16} className="text-yellow-400" /> : <Type size={16} className="text-purple-400" />}
                {textModal.type === "sticky" ? "Criar Nota Adesiva (Post-it)" : "Inserir Texto no Quadro"}
              </h4>
              <button
                onClick={() => setTextModal(null)}
                className="text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              autoFocus
              value={textInputVal}
              onChange={(e) => setTextInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleCommitText();
                }
              }}
              placeholder={textModal.type === "sticky" ? "Escreva o insight ou tarefa rápida..." : "Digite o texto..."}
              className="w-full h-28 bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-purple-500 resize-none transition-colors"
            />

            <div className="flex items-center justify-between text-xs text-white/40">
              <span>Pressione Ctrl+Enter para salvar</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setTextModal(null)}
                  className="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCommitText}
                  disabled={!textInputVal.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-[0_0_15px_rgba(147,51,234,0.4)] disabled:opacity-50"
                >
                  <Check size={14} /> Inserir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget Inferior Direito de Zoom e Pan */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/90 backdrop-blur-md border border-white/15 shadow-2xl text-white">
        <button
          onClick={() => handleZoomChange(0.85)}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut size={16} />
        </button>
        <span className="px-2 text-xs font-semibold text-purple-300 min-w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => handleZoomChange(1.15)}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn size={16} />
        </button>
        <div className="h-4 w-px bg-white/10" />
        <button
          onClick={resetView}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Centralizar Câmera (0)"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Canvas Principal */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full touch-none ${
          readOnly || activeTool === "hand" || isSpacePressed
            ? "cursor-grab active:cursor-grabbing"
            : activeTool === "text" || activeTool === "sticky"
            ? "cursor-text"
            : activeTool === "rect"
            ? "cursor-crosshair"
            : activeTool === "eraser"
            ? "cursor-cell"
            : "cursor-crosshair"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
