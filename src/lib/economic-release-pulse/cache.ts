// アダプタ単位の in-memory TTL キャッシュ。
// 経済指標カレンダーは日内でほぼ変わらないため既定 6h。
// MCP プロセス存続中のみ有効（プロセス再起動でクリア）。

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

// 既定 TTL（6 時間）。
export const DEFAULT_CACHE_TTL_MS = 6 * 3600 * 1000;

// key で引き、未キャッシュ or 期限切れなら fn() を実行して格納する。
// fn() が throw した場合はキャッシュせず素通しで throw（失敗を握り込まない）。
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

// テスト用: キャッシュを全消去する。
export function clearCache(): void {
  store.clear();
}
