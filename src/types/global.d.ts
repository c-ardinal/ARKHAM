// src/types/global.d.ts
// H-T1: Window 型拡張 — ARKHAM 固有のグローバルフラグを型安全に宣言（as any キャスト排除）
export {};

declare global {
  interface Window {
    /** 未来バージョンのシナリオデータが検出されたとき store が設定するフラグ。Layout.tsx で mount 時に読み取り toast 表示後に削除する。 */
    __ARKHAM_FUTURE_VERSION_DETECTED__?: number;
  }
}
