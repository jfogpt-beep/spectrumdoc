import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpectrumDoc",
  description: "Análisis espectral de documentos, imágenes y web",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
