export function isDirectVideo(url: string) {
  if (!url) return false;
  return url.startsWith("/videos/") || /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

export function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}
