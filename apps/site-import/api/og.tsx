import React from "react";
import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get dynamic parameters
    const title = searchParams.get("title") || "Realms World";
    const description =
      searchParams.get("description") || "The future of gaming is onchain";
    const path = searchParams.get("path") || "";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            backgroundImage:
              "radial-gradient(circle at 25% 25%, #1a1a1a 0%, #0a0a0a 50%)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Background Pattern */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 10px,
                  rgba(255, 255, 255, 0.02) 10px,
                  rgba(255, 255, 255, 0.02) 20px
                )
              `,
            }}
          />

          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              style={{ marginRight: 20 }}
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: "white",
              }}
            >
              Realms World
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
              marginBottom: 20,
              maxWidth: 900,
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>

          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: 24,
                color: "#a1a1aa",
                textAlign: "center",
                maxWidth: 800,
                marginBottom: 40,
                lineHeight: 1.4,
              }}
            >
              {description}
            </div>
          )}

          {/* Bottom Bar */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              display: "flex",
              alignItems: "center",
              gap: 40,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                }}
              />
              <span style={{ color: "#a1a1aa", fontSize: 18 }}>
                Powered by $LORDS
              </span>
            </div>
            {path && (
              <span style={{ color: "#6b7280", fontSize: 18 }}>
                realms.world{path}
              </span>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
