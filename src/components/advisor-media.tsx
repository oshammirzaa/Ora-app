import { isDirectVideo, youtubeId } from "@/lib/video";
import { cn } from "@/lib/utils";

export function AdvisorMedia({
  photo,
  video,
  className,
  alt = "",
  eager = false,
}: {
  photo: string;
  video?: string;
  className?: string;
  alt?: string;
  eager?: boolean;
}) {
  if (video && isDirectVideo(video)) {
    return (
      <video
        src={video}
        poster={photo || undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={cn("size-full object-cover", className)}
      />
    );
  }
  if (!photo) {
    return <div className={cn("size-full bg-elevated", className)} aria-hidden />;
  }
  return (
    <img
      src={photo}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  );
}

export function AdvisorVideoEmbed({ url }: { url: string }) {
  const yt = youtubeId(url);
  if (yt) {
    return (
      <iframe
        title="Intro video"
        src={`https://www.youtube.com/embed/${yt}`}
        className="aspect-video w-full rounded-lg bg-elevated"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (isDirectVideo(url)) {
    return (
      <video src={url} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-elevated" />
    );
  }
  return (
    <a href={url} className="text-sm text-primary" target="_blank" rel="noreferrer">
      Intro video
    </a>
  );
}
