import { NextRequest, NextResponse } from "next/server";

const STOPWORDS = new Set([
  "el", "la", "de", "que", "y", "a", "en", "un", "es", "se", "no", "te", "lo",
  "le", "da", "su", "por", "son", "con", "para", "al", "del", "los", "las",
  "una", "como", "más", "pero", "sus", "me", "si", "ya", "o", "este", "esta",
  "eso", "todo", "muy", "hay", "the", "and", "for", "are", "but", "not", "you",
]);

function extractText(content: string): string {
  return content.replace(/[^\wáéíóúñüÁÉÍÓÚÑÜ\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function wordFrequency(text: string) {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const freq: Record<string, number> = {};
  words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));
}

function rhythm(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, 80).map((w, i) => ({ pos: i, length: w.length }));
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const url = form.get("url") as string | null;

    let text = "";

    if (url) {
      const r = await fetch(url, { headers: { "User-Agent": "SpectrumDoc/1.0" }, signal: AbortSignal.timeout(10000) });
      const html = await r.text();
      text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
      text = extractText(text);
    } else if (file) {
      const buf = await file.arrayBuffer();
      const name = file.name.toLowerCase();
      if (name.endsWith(".txt") || file.type === "text/plain") {
        text = new TextDecoder().decode(buf);
      } else if (name.endsWith(".pdf")) {
        const raw = new TextDecoder("latin1").decode(buf);
        const matches = raw.match(/\((?:\\.|[^\\)])+\)/g) || [];
        text = matches.map((m) => m.slice(1, -1).replace(/\\n/g, " ").replace(/\\/g, "")).join(" ");
        if (text.length < 50) text = "PDF detectado. Extracción básica aplicada.";
      } else {
        text = "Imagen recibida. Análisis de bordes y OCR completo requiere backend Python.";
      }
      text = extractText(text);
    } else {
      return NextResponse.json({ error: "No se recibió archivo ni URL" }, { status: 400 });
    }

    if (!text || text.length < 5) text = "Contenido insuficiente para generar espectro significativo.";

    return NextResponse.json({
      wordFreq: wordFrequency(text),
      rhythm: rhythm(text),
      rawText: text.slice(0, 500),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error de procesamiento" }, { status: 500 });
  }
}
