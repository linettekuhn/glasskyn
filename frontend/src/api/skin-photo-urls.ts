import { getPresignedDownloadUrl } from "./uploads";

/**
 * Shared presigned-URL cache for skin photos.
 *
 * Presigned S3 URLs embed a signature + expiry, so the URL string changes on
 * every `GET /uploads/{key}/url` call. That defeats `expo-image`'s
 * `memory-disk` cache (keyed by URL) and meant the journal card and the
 * montage each re-signed every photo on every mount. This module caches by
 * S3 file key instead, dedupes in-flight sign requests, and lets the montage
 * seed its first frame synchronously from what the journal card already
 * resolved.
 */

// Backend signs with a 1h expiry; refresh a bit early.
const URL_TTL_MS = 50 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
  width?: number;
  height?: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry != null && entry.expiresAt > Date.now();
}

/** Synchronous cache read for instant first-frame seeding. */
export function getCachedSkinPhotoUrlSync(fileKey: string): string | null {
  const entry = cache.get(fileKey);
  return isFresh(entry) ? entry.url : null;
}

/** Intrinsic dimensions previously measured for this file key, if known. */
export function getCachedSkinPhotoDimsSync(
  fileKey: string,
): { width: number; height: number } | null {
  const entry = cache.get(fileKey);
  if (entry?.width && entry?.height) {
    return { width: entry.width, height: entry.height };
  }
  return null;
}

/** Store a resolved URL (and optionally intrinsic dims) for reuse. */
export function primeSkinPhotoUrlCache(
  fileKey: string,
  url: string,
  width?: number,
  height?: number,
): void {
  const prev = cache.get(fileKey);
  cache.set(fileKey, {
    url,
    expiresAt: Date.now() + URL_TTL_MS,
    width: width ?? prev?.width,
    height: height ?? prev?.height,
  });
}

/** Store measured dimensions against the cached URL entry, if present. */
export function primeSkinPhotoDims(
  fileKey: string,
  width: number,
  height: number,
): void {
  if (!width || !height) return;
  const prev = cache.get(fileKey);
  if (prev) {
    prev.width = width;
    prev.height = height;
  } else {
    cache.set(fileKey, {
      url: "",
      expiresAt: 0,
      width,
      height,
    });
  }
}

/**
 * Cached + deduped presigned URL fetch. Concurrent callers for the same key
 * share one network request. On failure, a stale URL is returned if one
 * exists so the photo can still attempt to load.
 */
export async function getCachedSkinPhotoUrl(fileKey: string): Promise<string> {
  const hit: CacheEntry | undefined = cache.get(fileKey);
  if (hit != null && hit.expiresAt > Date.now()) return hit.url;
  const staleUrl: string | undefined = hit?.url;
  const ongoing = inflight.get(fileKey);
  if (ongoing) return ongoing;
  const request = getPresignedDownloadUrl(fileKey)
    .then((url) => {
      primeSkinPhotoUrlCache(fileKey, url);
      return url;
    })
    .catch((err) => {
      // A stale URL may still load if S3 hasn't expired it server-side.
      if (staleUrl) return staleUrl;
      throw err;
    })
    .finally(() => {
      if (inflight.get(fileKey) === request) inflight.delete(fileKey);
    });
  inflight.set(fileKey, request);
  return request;
}

/** Best-effort warm of upcoming keys; never rejects. */
export function prefetchSkinPhotoUrls(fileKeys: string[]): Promise<void> {
  const unique = [...new Set(fileKeys)].filter(
    (k) => k && !isFresh(cache.get(k)) && !inflight.has(k),
  );
  if (unique.length === 0) return Promise.resolve();
  return Promise.allSettled(unique.map((k) => getCachedSkinPhotoUrl(k))).then(
    () => {},
  );
}
