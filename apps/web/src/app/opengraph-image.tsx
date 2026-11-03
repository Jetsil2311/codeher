import { ImageResponse } from "next/og";

export const alt = "CODEHER · Programar es para ti";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f7f7", position: "relative", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", right: -120, top: -160, width: 560, height: 560, borderRadius: 9999, background: "#9b5de5" }} />
        <div style={{ position: "absolute", left: -120, bottom: -200, width: 460, height: 460, borderRadius: 9999, background: "#f15bb5" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px", position: "relative" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, letterSpacing: -3 }}>
            <span style={{ color: "#9b5de5" }}>CODE</span>
            <span style={{ color: "#f15bb5" }}>HER</span>
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, color: "#1b1030", marginTop: 18 }}>Programar es para ti</div>
          <div style={{ fontSize: 30, color: "#4a4060", marginTop: 18, maxWidth: 760 }}>Python y pseudocódigo en español para chicas de 12 a 18 años en el Estado de México.</div>
        </div>
      </div>
    ),
    size,
  );
}
