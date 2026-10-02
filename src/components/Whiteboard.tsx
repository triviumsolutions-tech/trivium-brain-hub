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
} from "lucide-react";

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
}

type ToolType = "pencil" | "eraser" | "hand";

const STROKE_WIDTHS = [
  { label: "Fino", value: 2 },
  { label: "Médio", value: 4 },
  { label: "Grosso", value: 8 },
  { label: "Marcador", value: 16 },
];

const PRESET_COLORS = [
  { name: "Preto", value: "#0f172a" },
  { name: "Roxo", value: "#9333ea" },
  { name: "Azul", value: "#2563eb" },
  { name: "Verde", value: "#16a34a" },
  { name: "Vermelho", value: "#dc2626" },
  { name: "Laranja", value: "#ea580c" },
];

function parseInitialData(initialData?: string) {
  if (!initialData) {
    return { strokes: [], pan: { x: 0, y: 0 }, zoom: 1, bgImage: null };
  }
  try {
    if (initialData.startsWith("{") && initialData.includes("strokes")) {
      const parsed = JSON.parse(initialData);
      return {
        strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
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
    return { strokes: [], pan: { x: 0, y: 0 }, zoom: 1, bgImage: initialData };
  }

  return { strokes: [], pan: { x: 0, y: 0 }, zoom: 1, bgImage: null };
}

export function Whiteboard({
  initialData,
  onSave,
}: {
  initialData?: string;
  onSave?: (data: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Inicialização de estado única e síncrona
  const [initialConfig] = useState(() => parseInitialData(initialData));

  // Estados de navegação (Infinite Canvas)
  const [pan, setPan] = useState<{ x: number; y: number }>(initialConfig.pan);
  const [zoom, setZoom] = useState<number>(initialConfig.zoom);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ferramentas
  const [activeTool, setActiveTool] = useState<ToolType>("pencil");
  const [color, setColor] = useState<string>("#0f172a");
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // Traços e Histórico
  const [strokes, setStrokes] = useState<Stroke[]>(initialConfig.strokes);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(initialConfig.strokes.length > 0);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const undoStackRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);

  // Imagem legada de fundo (para compatibilidade caso o projeto tenha sido salvo como PNG)
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

  // Renderiza um traço no contexto
  const renderSingleStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.isEraser ? "#ffffff" : stroke.color;

    ctx.beginPath();
    if (stroke.points.length === 1) {
      ctx.arc(
        stroke.points[0].x,
        stroke.points[0].y,
        stroke.width / 2,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = stroke.isEraser ? "#ffffff" : stroke.color;
      ctx.fill();
    } else {
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
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

    // 1. Limpa tela com fundo branco puro
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Grid de pontos infinito moderno (Dot Grid)
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

    // 3. Aplica transformação do Mundo Virtual (Pan & Zoom)
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Se houver desenho anterior em imagem legada
    if (bgImageElementRef.current) {
      ctx.drawImage(bgImageElementRef.current, 0, 0);
    }

    // 4. Renderiza todos os traços finalizados
    for (const stroke of strokes) {
      renderSingleStroke(ctx, stroke);
    }

    // 5. Renderiza o traço ativo sendo desenhado agora
    if (activeStroke) {
      renderSingleStroke(ctx, activeStroke);
    }

    ctx.restore();
    ctx.restore();
  }, [pan, zoom, strokes, activeStroke]);

  // Carrega a imagem de fundo legada (se houver)
  useEffect(() => {
    if (!initialConfig.bgImage) return;
    const img = new Image();
    img.onload = () => {
      bgImageElementRef.current = img;
      redraw();
    };
    img.src = initialConfig.bgImage;
  }, [initialConfig.bgImage, redraw]);

  // Redimensionamento do canvas com suporte a Retina/DPR
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

  // Executa redesenho sempre que o estado muda
  useEffect(() => {
    redraw();
  }, [redraw]);

  // Salva no formato vetorial expansível
  const triggerSave = useCallback(
    (newStrokes: Stroke[], currentPan = pan, currentZoom = zoom) => {
      if (!onSave) return;
      const payload = JSON.stringify({
        version: 2,
        strokes: newStrokes,
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
    if (strokes.length === 0) return;
    const previousState = undoStackRef.current.pop();
    redoStackRef.current.push([...strokes]);
    const nextStrokes = previousState || strokes.slice(0, -1);
    setStrokes(nextStrokes);
    setCanUndo(undoStackRef.current.length > 0 || nextStrokes.length > 0);
    setCanRedo(true);
    triggerSave(nextStrokes);
  }, [strokes, triggerSave]);

  // Refazer (Redo)
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const nextState = redoStackRef.current.pop();
    if (nextState) {
      undoStackRef.current.push([...strokes]);
      setStrokes(nextState);
      setCanUndo(true);
      setCanRedo(redoStackRef.current.length > 0);
      triggerSave(nextState);
    }
  }, [strokes, triggerSave]);

  // Limpar quadro com histórico
  const handleClear = useCallback(() => {
    if (strokes.length === 0 && !bgImageElementRef.current) return;
    if (
      !confirm(
        "Deseja limpar todo o quadro? Você pode usar Desfazer (Ctrl+Z) se mudar de ideia."
      )
    )
      return;

    undoStackRef.current.push([...strokes]);
    redoStackRef.current = [];
    setStrokes([]);
    setCanUndo(true);
    setCanRedo(false);
    bgImageElementRef.current = null;
    legacyBgDataRef.current = null;
    triggerSave([]);
  }, [strokes, triggerSave]);

  // Botões de Zoom (+ / -) centrados na tela
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
    },
    [pan, zoom]
  );

  // Volta para a origem e zoom 100%
  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // Centraliza na tela
  const fitToCenter = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setPan({ x: rect.width / 4, y: rect.height / 4 });
    setZoom(1);
  }, []);

  // Atalhos de Teclado (Ctrl+Z, Ctrl+Y, Espaço, H, P, E, +, -)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "z" || e.key === "Z") &&
        !e.shiftKey
      ) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "h" || e.key === "H") {
        setActiveTool("hand");
      } else if (e.key === "p" || e.key === "P") {
        setActiveTool("pencil");
      } else if (e.key === "e" || e.key === "E") {
        setActiveTool("eraser");
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handleZoomChange(1.2);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomChange(0.8);
      } else if (e.key === "0") {
        e.preventDefault();
        resetView();
      }
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

  // Zoom centrado pelo Mouse Wheel
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

  // Eventos de Mouse e Touch
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const isPanMode =
      activeTool === "hand" ||
      isSpacePressed ||
      e.button === 1 ||
      e.button === 2;

    if (isPanMode) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      };
      return;
    }

    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPoint = screenToWorld(clientX, clientY);

    const isEraser = activeTool === "eraser";
    const newStroke: Stroke = {
      id: `${Date.now()}-${Math.random()}`,
      points: [worldPoint],
      color,
      width: isEraser ? strokeWidth * 4 : strokeWidth,
      isEraser,
    };

    setActiveStroke(newStroke);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    if (!activeStroke) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPoint = screenToWorld(clientX, clientY);

    setActiveStroke((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, worldPoint],
      };
    });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (activeStroke) {
      undoStackRef.current.push([...strokes]);
      redoStackRef.current = [];
      const updatedStrokes = [...strokes, activeStroke];
      setStrokes(updatedStrokes);
      setCanUndo(true);
      setCanRedo(false);
      setActiveStroke(null);
      triggerSave(updatedStrokes);
    }
  };

  // Suporte a Touch
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const isPanMode = activeTool === "hand" || isSpacePressed;

      if (isPanMode) {
        setIsPanning(true);
        panStartRef.current = {
          x: touch.clientX - pan.x,
          y: touch.clientY - pan.y,
        };
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;
      const worldPoint = screenToWorld(clientX, clientY);

      const isEraser = activeTool === "eraser";
      const newStroke: Stroke = {
        id: `${Date.now()}-${Math.random()}`,
        points: [worldPoint],
        color,
        width: isEraser ? strokeWidth * 4 : strokeWidth,
        isEraser,
      };

      setActiveStroke(newStroke);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isPanning && e.touches.length === 1) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - panStartRef.current.x,
        y: touch.clientY - panStartRef.current.y,
      });
      return;
    }

    if (activeStroke && e.touches.length === 1) {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;
      const worldPoint = screenToWorld(clientX, clientY);

      setActiveStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, worldPoint],
        };
      });
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  // Determina o cursor
  const getCursorClass = () => {
    if (isPanning) return "cursor-grabbing";
    if (activeTool === "hand" || isSpacePressed) return "cursor-grab";
    if (activeTool === "eraser") return "cursor-cell";
    return "cursor-crosshair";
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col select-none overflow-hidden bg-slate-900 rounded-2xl border border-white/10 shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Barra de Ferramentas Superior (Floating Toolbar) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/90 backdrop-blur-md border border-white/15 shadow-2xl text-white">
        {/* Ferramentas Principais */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTool("pencil")}
            className={`p-2.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              activeTool === "pencil"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title="Caneta (P)"
          >
            <Pencil size={17} />
            <span className="hidden sm:inline">Caneta</span>
          </button>

          <button
            onClick={() => setActiveTool("eraser")}
            className={`p-2.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              activeTool === "eraser"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title="Borracha (E)"
          >
            <Eraser size={17} />
            <span className="hidden sm:inline">Borracha</span>
          </button>

          <button
            onClick={() => setActiveTool("hand")}
            className={`p-2.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              activeTool === "hand"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title="Mover Quadro (H ou Segurar Espaço)"
          >
            <Hand size={17} />
            <span className="hidden sm:inline">Mover</span>
          </button>
        </div>

        <div className="h-6 w-px bg-white/10" />

        {/* Espessuras */}
        <div className="flex items-center gap-1">
          {STROKE_WIDTHS.map((item) => (
            <button
              key={item.value}
              onClick={() => setStrokeWidth(item.value)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
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
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c.value && activeTool !== "eraser"
                  ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}

          {/* Color Picker nativo */}
          <label className="relative cursor-pointer flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-rose-500 via-emerald-500 to-sky-500 p-0.5 border border-white/20 hover:scale-105 transition-transform" title="Cor personalizada">
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
            disabled={!canUndo && strokes.length === 0}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={handleClear}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors ml-1"
            title="Limpar Todo o Quadro"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Widget Inferior Direito de Zoom e Pan */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/90 backdrop-blur-md border border-white/15 shadow-2xl text-white">
        <button
          onClick={() => handleZoomChange(0.85)}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut size={16} />
        </button>

        <button
          onClick={resetView}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white/10 transition-colors text-purple-300 hover:text-white"
          title="Redefinir Zoom para 100% (Atalho: 0)"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={() => handleZoomChange(1.15)}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn size={16} />
        </button>

        <div className="h-5 w-px bg-white/10" />

        <button
          onClick={fitToCenter}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs"
          title="Centralizar Visão"
        >
          <RotateCcw size={15} />
          <span className="hidden sm:inline">Centralizar</span>
        </button>
      </div>

      {/* Dica de Atalho no Canto Inferior Esquerdo */}
      <div className="absolute bottom-4 left-4 z-30 pointer-events-none hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-white/60">
        <span>💡 <b>Espaço + Arrastar</b> ou <b>Botão do Meio</b> para navegar</span>
        <span>•</span>
        <span><b>Roda do Mouse</b> para Zoom</span>
        <span>•</span>
        <span><b>Ctrl+Z</b> para Desfazer</span>
      </div>

      {/* Área do Canvas Interativo */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full touch-none ${getCursorClass()}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
