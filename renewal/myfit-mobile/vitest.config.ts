import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// 범위 한정 원칙 (G2 2026-07-28 K1 · cinderella 템플릿 이식):
//   전면 커버리지가 목표가 **아니다.** 대상은 `eval/highrisk_paths.json` 에 동결된
//   고위험 경로(인증·개인정보)뿐이다. include 를 tests/highrisk 로 묶어
//   "테스트가 늘어나면 자동으로 전면 확대되는" 드리프트를 막는다.
//   범위를 넓히려면 이 줄을 의도적으로 고쳐야 하고, 그 diff 가 리뷰에 남는다.
export default defineConfig({
  plugins: [react()],
  // tsconfig 는 `jsx: "preserve"`(Next 가 처리) → esbuild 가 classic 런타임으로 떨어져
  // 소스에 `import React` 가 없으면 깨진다. 자동 런타임을 명시해 고정한다.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    include: ["tests/highrisk/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/highrisk/setup.ts"],
    reporters: ["default"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
