"use client";

import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, Image as ImageIcon, Globe, Loader2, Zap, Upload, Download, FolderOpen } from "lucide-react";

type Tab = "doc" | "image" | "web";

interface SpectrumData {
  wordFreq: { word: string; count: number }[];
  rhythm: { pos: number; length: number }[];
  rawText?: string;
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
              onChange={(e) => processFile(e.target.files?.[0] || null)}
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

        {spectrum ? (
          <div className="space-y-6">
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

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={downloadSpectrum}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
              >
                <Download size={16} /> Descargar Espectro
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
