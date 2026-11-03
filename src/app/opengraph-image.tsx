import { ImageResponse } from "next/og";
import { IP } from "@/lib/ip";

export const alt = `${IP.brand} — сайт без оплаты разработки`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "#eef2f4",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(14,26,36,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(14,26,36,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#0d7377",
              fontSize: 42,
              fontWeight: 700,
              fontFamily: "sans-serif",
              letterSpacing: -1,
            }}
          >
            {IP.brand}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 900,
              color: "#0e1a24",
              fontSize: 54,
              fontWeight: 700,
              fontFamily: "sans-serif",
              letterSpacing: -1.5,
              lineHeight: 1.15,
            }}
          >
            Сайт без предоплаты. Платите с заявок с сайта.
          </div>
          <div
            style={{
              display: "flex",
              color: "#3d4f5c",
              fontSize: 28,
              fontFamily: "sans-serif",
              maxWidth: 820,
              lineHeight: 1.35,
            }}
          >
            Демо до договора. 10% с заявок с сайта или выкуп 29 000 ₽.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
