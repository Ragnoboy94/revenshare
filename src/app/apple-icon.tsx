import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch: large RS over pale bilateral wave arcs */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f2f5f6",
          position: "relative",
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <path
            d="M56 46c-12 15-12 73 0 88"
            fill="none"
            stroke="#0d7377"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.38"
          />
          <path
            d="M34 30c-18 22-18 98 0 120"
            fill="none"
            stroke="#0d7377"
            strokeWidth="6.5"
            strokeLinecap="round"
            opacity="0.28"
          />
          <path
            d="M14 18c-22 26-22 118 0 144"
            fill="none"
            stroke="#0d7377"
            strokeWidth="5.5"
            strokeLinecap="round"
            opacity="0.18"
          />
          <path
            d="M124 46c12 15 12 73 0 88"
            fill="none"
            stroke="#0d7377"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.38"
          />
          <path
            d="M146 30c18 22 18 98 0 120"
            fill="none"
            stroke="#0d7377"
            strokeWidth="6.5"
            strokeLinecap="round"
            opacity="0.28"
          />
          <path
            d="M166 18c22 26 22 118 0 144"
            fill="none"
            stroke="#0d7377"
            strokeWidth="5.5"
            strokeLinecap="round"
            opacity="0.18"
          />
        </svg>
        <div
          style={{
            display: "flex",
            color: "#0d7377",
            fontSize: 92,
            fontWeight: 700,
            fontFamily: "sans-serif",
            letterSpacing: -4,
            lineHeight: 1,
            position: "relative",
          }}
        >
          RS
        </div>
      </div>
    ),
    { ...size },
  );
}
