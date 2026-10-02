"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser, Pencil, Trash2 } from "lucide-react";

export function Whiteboard({ initialData, onSave }: { initialData?: string, onSave?: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000"); // Preto como cor padrão
  const [isErasing, setIsErasing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Configura a resolução interna do canvas para o tamanho real do elemento HTML
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight || 600; 
    
    // Preenche o fundo com BRANCO PURO
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialData;
    }
  }, [initialData]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && onSave) {
      onSave(canvas.toDataURL("image/png"));
    }
    canvas?.getContext("2d")?.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = isErasing ? 30 : 3;
    ctx.lineCap = "round";
    
    if (isErasing) {
      // Ao apagar, desenha por cima com branco (pois o fundo é branco)
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#ffffff";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (onSave) onSave("");
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <div className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/10">
        <div className="flex gap-2">
          <button onClick={() => setIsErasing(false)} className={`p-2 rounded-lg transition-colors ${!isErasing ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-white/70'}`} title="Lápis">
            <Pencil size={18} />
          </button>
          <button onClick={() => setIsErasing(true)} className={`p-2 rounded-lg transition-colors ${isErasing ? 'bg-purple-600 text-white' : 'hover:bg-white/10 text-white/70'}`} title="Borracha">
            <Eraser size={18} />
          </button>
          <input 
            type="color" 
            value={color} 
            onChange={e => setColor(e.target.value)} 
            disabled={isErasing}
            className="w-9 h-9 rounded cursor-pointer bg-transparent border-0 p-0 ml-2" 
          />
        </div>
        <button onClick={clearCanvas} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
          <Trash2 size={16} /> Limpar Quadro
        </button>
      </div>
      <div className="flex-1 rounded-xl border border-white/20 overflow-hidden bg-white shadow-inner cursor-crosshair relative min-h-[500px]">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="w-full h-full touch-none"
        />
      </div>
    </div>
  );
}
