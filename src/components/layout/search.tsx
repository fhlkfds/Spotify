"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Music, User, Disc, Tag } from "lucide-react";

interface SearchResult {
  artists: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    playCount: number;
    type: "artist";
  }>;
  tracks: Array<{
    id: string;
    name: string;
    artistName: string;
    imageUrl: string | null;
    playCount: number;
    type: "track";
  }>;
  albums: Array<{
    id: string;
    name: string;
    artistName: string;
    imageUrl: string | null;
    playCount: number;
    type: "album";
  }>;
  genres: Array<{
    name: string;
    type: "genre";
  }>;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            setResults(data.results);
            setIsOpen(true);
          }
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults(null);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const handleClear = () => {
    setQuery("");
    setResults(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleResultClick = () => {
    setIsOpen(false);
    setQuery("");
  };

  const hasResults =
    results &&
    (results.artists.length > 0 ||
      results.tracks.length > 0 ||
      results.albums.length > 0 ||
      results.genres.length > 0);

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search artists, songs, albums, genres..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setIsOpen(true)}
          className="h-9 w-full rounded-full bg-muted/50 border border-border pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all sm:w-64"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full max-h-96 overflow-y-auto rounded-lg border bg-card shadow-lg z-50 sm:w-80">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-2">
              {/* Artists */}
              {results.artists.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Artists
                  </div>
                  {results.artists.map((artist) => (
                    <Link
                      key={artist.id}
                      href={`/dashboard/artists/${artist.id}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {artist.imageUrl ? (
                          <Image
                            src={artist.imageUrl}
                            alt={artist.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{artist.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {artist.playCount} plays
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Tracks */}
              {results.tracks.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Songs
                  </div>
                  {results.tracks.map((track) => (
                    <Link
                      key={track.id}
                      href={`/dashboard/tracks/${track.id}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="relative h-10 w-10 rounded overflow-hidden bg-muted flex-shrink-0">
                        {track.imageUrl ? (
                          <Image
                            src={track.imageUrl}
                            alt={track.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Music className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{track.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artistName} - {track.playCount} plays
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Albums */}
              {results.albums.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Albums
                  </div>
                  {results.albums.map((album) => (
                    <Link
                      key={album.id}
                      href={`/dashboard/albums`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="relative h-10 w-10 rounded overflow-hidden bg-muted flex-shrink-0">
                        {album.imageUrl ? (
                          <Image
                            src={album.imageUrl}
                            alt={album.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Disc className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{album.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {album.artistName} - {album.playCount} plays
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Genres */}
              {results.genres.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Genres
                  </div>
                  <div className="px-3 py-2 flex flex-wrap gap-2">
                    {results.genres.map((genre) => (
                      <span
                        key={genre.name}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm"
                      >
                        <Tag className="h-3 w-3" />
                        {genre.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
