"use client";

function getSpotifyEmbedUrl(url: string): string | null {
  const match = url.match(
    /open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/
  );
  if (!match) return null;
  return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
}

function getAppleMusicEmbedUrl(url: string): string | null {
  // Covers tracks, albums, playlists: swap host to embed.music.apple.com
  if (!url.includes("music.apple.com")) return null;
  return url.replace("music.apple.com", "embed.music.apple.com");
}

function getStravaEmbedUrl(url: string): string | null {
  const match = url.match(/strava\.com\/activities\/(\d+)/);
  if (!match) return null;
  return `https://strava-embeds.com/activity/${match[1]}`;
}

interface EmbedBlockProps {
  url: string;
  label: string;
  isEditing?: boolean;
  onUpdate?: (content: { url: string }) => void;
}

export function EmbedBlock({ url, label, isEditing, onUpdate }: EmbedBlockProps) {
  if (isEditing && !url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <input
          type="text"
          placeholder={`Paste ${label} URL...`}
          className="w-full rounded-[15px] border border-primary bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdate?.({ url: e.currentTarget.value });
            }
          }}
        />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text/30">
        No {label} link
      </div>
    );
  }

  const spotifyEmbed = label === "Spotify" ? getSpotifyEmbedUrl(url) : null;
  const appleMusicEmbed = label === "Apple Music" ? getAppleMusicEmbedUrl(url) : null;
  const stravaEmbed = label === "Strava" ? getStravaEmbedUrl(url) : null;
  const embedUrl = spotifyEmbed || appleMusicEmbed || stravaEmbed;

  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        className="h-full w-full rounded-[15px]"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-accent underline"
      >
        Open in {label}
      </a>
      {isEditing && (
        <button
          onClick={() => onUpdate?.({ url: "" })}
          className="text-xs text-text/40 hover:text-accent"
        >
          Change URL
        </button>
      )}
    </div>
  );
}
