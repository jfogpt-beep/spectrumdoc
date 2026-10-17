"use client";

import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, Image as ImageIcon, Globe, Loader2, Zap, Upload, Download, FolderOpen, ImageDown, RotateCcw } from "lucide-react";

type Tab = "doc" | "image" | "web";

interface SpectrumData {
  wordFreq: { word: string; count: number }[];
  rhythm: { pos: number; length: number }[];
  rawText?: string;
  edges?: { width: number; height: number; data: number[] };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("doc");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [spectrum, setSpectrum] = useState<SpectrumData | null>(null);
  const [decoded, setDecoded] = useState("");
  const [url, setUrl] = useState("");
  const [bytesInput, setBytesInput] = useState("");

  const processFile = async (file: File | null, isUrl = false) => {
    if (!file && !isUrl) return;
    setLoading(true);
    setStatus("Análisis espectral en curso...");
    setSpectrum(null);
    setDecoded("");

    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (isUrl) form.append("url", url);
      form.append("type", tab);

      const res = await fetch("/api/process", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSpectrum(data);
      setStatus("Espectro generado");
    } catch (e: any) {
      setStatus("Error: " + (e.message || "procesamiento fallido"));
    } finally {
      setLoading(false);
    }
  };

  const decode = async () => {
    if (!spectrum) return;
    setLoading(true);
    setStatus("Decodificando señal...");
    try {
      const res = await fetch("/api/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spectrum, type: tab }),
      });
      const data = await res.json();
      setDecoded(data.result || "Sin resultado");
    } catch {
      setDecoded("Error al decodificar");
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const decodeBytes = () => {
    try {
      const nums = bytesInput.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n) && n >= 0 && n <= 255);
      setDecoded(String.fromCharCode(...nums) || "Sin caracteres válidos");
    } catch {
      setDecoded("Entrada inválida");
    }
  };

  const downloadSpectrum = () => {
    if (!spectrum) return;
    const blob = new Blob([JSON.stringify(spectrum, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `spectrum-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Espectro descargado");
  };

  const processImageEdges = (file: File): Promise<{ width: number; height: number; data: number[]; colors: number[] }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 512;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const edges: number[] = [];
        const colors: number[] = [];

        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            
            const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            const gUp = data[((y - 1) * canvas.width + x) * 4] * 0.299 + data[((y - 1) * canvas.width + x) * 4 + 1] * 0.587 + data[((y - 1) * canvas.width + x) * 4 + 2] * 0.114;
            const gDn = data[((y + 1) * canvas.width + x) * 4] * 0.299 + data[((y + 1) * canvas.width + x) * 4 + 1] * 0.587 + data[((y + 1) * canvas.width + x) * 4 + 2] * 0.114;
            const gLf = data[(y * canvas.width + x - 1) * 4] * 0.299 + data[(y * canvas.width + x - 1) * 4 + 1] * 0.587 + data[(y * canvas.width + x - 1) * 4 + 2] * 0.114;
            const gRt = data[(y * canvas.width + x + 1) * 4] * 0.299 + data[(y * canvas.width + x + 1) * 4 + 1] * 0.587 + data[(y * canvas.width + x + 1) * 4 + 2] * 0.114;

            const gx = gRt - gLf;
            const gy = gDn - gUp;
            edges.push(Math.min(255, Math.sqrt(gx * gx + gy * gy) * 2));

            // Store full color every pixel for better reconstruction
            colors.push(data[idx], data[idx + 1], data[idx + 2]);
          }
        }
        resolve({ width: canvas.width - 2, height: canvas.height - 2, data: edges, colors });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const reconstructImage = () => {
    if (!spectrum?.edges) {
      setStatus("No hay espectro de imagen para reconstruir");
      return;
    }
    const { width, height, data, colors } = spectrum.edges as any;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < data.length; i++) {
      const edge = data[i];
      const cIdx = i * 3;
      
      // Blend original color with edge enhancement
      let r = colors?.[cIdx] ?? edge;
      let g = colors?.[cIdx + 1] ?? edge;
      let b = colors?.[cIdx + 2] ?? edge;

      // Enhance edges
      if (edge > 60) {
        r = Math.min(255, r * 0.7 + 255 * 0.3);
        g = Math.min(255, g * 0.7 + 255 * 0.3);
        b = Math.min(255, b * 0.7 + 255 * 0.3);
      }

      imageData.data[i * 4] = r;
      imageData.data[i * 4 + 1] = g;
      imageData.data[i * 4 + 2] = b;
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // Upscale 2x with smoothing for better quality
    const upscale = document.createElement("canvas");
    upscale.width = width * 2;
    upscale.height = height * 2;
    const uctx = upscale.getContext("2d")!;
    uctx.imageSmoothingEnabled = true;
    uctx.imageSmoothingQuality = "high";
    uctx.drawImage(canvas, 0, 0, upscale.width, upscale.height);

    const a = document.createElement("a");
    a.href = upscale.toDataURL("image/png");
    a.download = `reconstructed-hq-${Date.now()}.png`;
    a.click();
    setStatus("Imagen reconstruida en alta calidad");
  };

  const downloadImage = async () => {
    const svg = document.querySelector(".recharts-wrapper svg") as SVGElement | null;
    if (!svg) {
      setStatus("Genera primero un espectro");
      return;
    }
    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width || 800;
        canvas.height = img.height || 400;
        ctx?.fillRect(0, 0, canvas.width, canvas.height);
        ctx?.drawImage(img, 0, 0);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `spectrum-chart-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus("Imagen del gráfico descargada");
      };
      img.src = url;
    } catch {
      setStatus("Error al generar imagen. Usa captura de pantalla.");
    }
  };

  const loadSpectrum = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.wordFreq && data.rhythm) {
          setSpectrum(data);
          setDecoded("");
          setStatus("Espectro restaurado");
        } else {
          setStatus("Archivo inválido");
        }
      } catch {
        setStatus("Error al leer el archivo");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-slate-800 overflow-y-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mb-1">
          SpectrumDoc
        </h1>
        <p className="text-slate-400 text-sm mb-6">Espectro de Datos • Frecuencia • Ritmo • Densidad</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "doc" as Tab, icon: FileText, label: "Documentos" },
            { id: "image" as Tab, icon: ImageIcon, label: "Imágenes" },
            { id: "web" as Tab, icon: Globe, label: "Web" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
                tab === t.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "doc" && (
          <div>
            <label className="block text-sm text-slate-300 mb-2">Subir PDF o TXT</label>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => processFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:text-white hover:file:bg-cyan-500"
            />
          </div>
        )}

        {tab === "image" && (
          <div>
            <label className="block text-sm text-slate-300 mb-2">Subir imagen (.png, .jpg)</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLoading(true);
                setStatus("Calculando espectro de bordes...");
                setSpectrum(null);
                try {
                  const edges = await processImageEdges(file);
                  let textData = { wordFreq: [], rhythm: [] };
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    form.append("type", "image");
                    const res = await fetch("/api/process", { method: "POST", body: form });
                    if (res.ok) textData = await res.json();
                  } catch {}
                  setSpectrum({ ...textData, edges });
                  setStatus(`Espectro generado (${edges.width}x${edges.height} bordes)`);
                } catch (err) {
                  console.error(err);
                  setStatus("Error al procesar imagen");
                } finally {
                  setLoading(false);
                }
              }}
              className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white"
            />
          </div>
        )}

        {tab === "web" && (
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://ejemplo.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => processFile(null, true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm"
            >
              <Globe size={16} /> Indexar URL
            </button>
          </div>
        )}

        <div className="mt-8 p-4 bg-slate-900/50 rounded-lg border border-slate-800">
          <h3 className="text-sm font-medium text-violet-300 mb-2">Simulador Criptográfico (ASCII reverso)</h3>
          <textarea
            value={bytesInput}
            onChange={(e) => setBytesInput(e.target.value)}
            placeholder="Ej: 72 111 108 97"
            className="w-full h-20 bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono"
          />
          <button onClick={decodeBytes} className="mt-2 px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded text-xs">
            Decodificar Bytes
          </button>
        </div>

        {/* Cargar espectro siempre visible */}
        <div className="mt-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm cursor-pointer w-fit">
            <FolderOpen size={16} /> Cargar Espectro (.json)
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadSpectrum(e.target.files[0])}
            />
          </label>
        </div>

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-cyan-400">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm">{status}</span>
          </div>
        )}
      </div>

      <div className="w-full md:w-1/2 p-6 overflow-y-auto">
        <div className="flex gap-2 mb-4">
          <span className="text-xs px-2 py-1 bg-slate-800 rounded">Gráficos del Espectro</span>
        </div>

        {/* Botones siempre visibles */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={downloadSpectrum}
            disabled={!spectrum}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-sm"
          >
            <Download size={16} /> Descargar Espectro
          </button>
          <button
            onClick={downloadImage}
            disabled={!spectrum}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-sm"
          >
            <ImageDown size={16} /> Descargar Imagen
          </button>
          <button
            onClick={reconstructImage}
            disabled={!spectrum?.edges}
            className="flex items-center gap-2 px-4 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded-lg text-sm"
          >
            <RotateCcw size={16} /> Reconstruir Imagen
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm cursor-pointer">
            <FolderOpen size={16} /> Cargar Espectro
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadSpectrum(e.target.files[0])}
            />
          </label>
        </div>

        {spectrum ? (
          <div className="space-y-6">
            {spectrum.edges && (
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                <h4 className="text-xs text-violet-400 mb-2">Espectro de Bordes (Imagen)</h4>
                <p className="text-xs text-slate-400">
                  Resolución: {spectrum.edges.width}×{spectrum.edges.height} · 
                  Puntos: {spectrum.edges.data.length.toLocaleString()} · 
                  Intensidad media: {(spectrum.edges.data.reduce((a,b)=>a+b,0)/spectrum.edges.data.length).toFixed(1)}
                </p>
              </div>
            )}

            {spectrum.wordFreq?.length > 0 && (
              <div className="h-52">
                <h4 className="text-xs text-cyan-400 mb-1">Espectro de Amplitud Semántica</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spectrum.wordFreq.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2937" />
                    <XAxis dataKey="word" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #22d3ee" }} />
                    <Bar dataKey="count" fill="#22d3ee" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {spectrum.rhythm?.length > 0 && (
              <div className="h-40">
                <h4 className="text-xs text-green-400 mb-1">Espectro de Longitud de Onda Rítmica</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spectrum.rhythm}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2937" />
                    <XAxis dataKey="pos" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #4ade80" }} />
                    <Line type="monotone" dataKey="length" stroke="#4ade80" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <button
              onClick={decode}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-violet-600 rounded-lg font-medium hover:opacity-90"
            >
              <Zap size={16} /> Decodificar Espectro de Señal
            </button>

            {decoded && (
              <div className="mt-4 p-4 bg-slate-900 border border-slate-700 rounded-lg">
                <h4 className="text-sm text-violet-300 mb-2">Resultado de la Señal Reconstruida</h4>
                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{decoded}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Upload size={40} className="mb-3 opacity-40" />
            <p className="text-sm text-center">Sube un archivo o URL para generar el espectro</p>
          </div>
        )}
      </div>
    </div>
  );
}
