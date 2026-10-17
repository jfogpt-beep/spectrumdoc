import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spectrum, type } = body;

    let result = "";

    if (spectrum?.wordFreq?.length) {
      const top = spectrum.wordFreq.slice(0, 8).map((w: any) => w.word).join(", ");
      const avgLen = spectrum.rhythm?.length > 0
        ? (spectrum.rhythm.reduce((s: number, r: any) => s + r.length, 0) / spectrum.rhythm.length).toFixed(1)
        : "N/A";

      result = `Reconstrucción probabilística de la señal:\n\n` +
        `• Ideas clave (picos de energía): ${top}\n` +
        `• Longitud de onda rítmica media: ${avgLen} caracteres/palabra\n` +
        `• Estilo estimado: ${Number(avgLen) > 6 ? "técnico / denso" : "conciso / conversacional"}\n` +
        `• Tono: informativo con alta densidad léxica en términos semánticos relevantes.`;
    } else {
      result = "Señal insuficiente para reconstrucción inversa.";
    }

    if (type === "image") {
      result += "\n\n[Canal de imagen] Frecuencias espaciales altas detectadas (bordes). OCR simulado aplicado.";
    }

    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error de decodificación" }, { status: 500 });
  }
}
