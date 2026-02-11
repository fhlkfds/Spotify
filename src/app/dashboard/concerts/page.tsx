"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stats/stat-card";
import {
  MapPin,
  Calendar,
  Clock,
  Ticket,
  ExternalLink,
  Music,
  Search,
  Navigation,
} from "lucide-react";

interface Concert {
  id: string;
  artistId: string;
  artistName: string;
  artistImageUrl: string | null;
  eventName: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  price: string;
  ticketUrl: string;
  distance: number | null;
}

interface ConcertsData {
  location: string;
  radiusMiles: number;
  concerts: Concert[];
  concertsByMonth: Record<string, Concert[]>;
  totalConcerts: number;
  artistsWithConcerts: number;
  message?: string;
}

export default function ConcertsPage() {
  const [data, setData] = useState<ConcertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("");
  const [inputLocation, setInputLocation] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [inputArtist, setInputArtist] = useState("");
  const [searchUSA, setSearchUSA] = useState(true);

  // Load location from localStorage on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem("userLocation");
    if (savedLocation) {
      setLocation(savedLocation);
      setInputLocation(savedLocation);
    } else {
      setLocation("New Orleans, LA");
      setInputLocation("New Orleans, LA");
    }
  }, []);

  // Fetch concerts when location changes
  useEffect(() => {
    if (!artistQuery) {
      setData(null);
      setLoading(false);
      return;
    }

    async function fetchConcerts() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        const useGeoFilter = Boolean(location) && !searchUSA;

        if (useGeoFilter) {
          params.set("location", location);
          params.set("radiusMiles", "100");
        }
        if (artistQuery) {
          params.set("artist", artistQuery);
          if (searchUSA) {
            params.set("countryCode", "US");
          }
        }

        const res = await fetch(`/api/concerts?${params.toString()}`);
        const payload = await res.json();
        if (res.ok) {
          setData(payload);
        } else {
          setData({
            location: useGeoFilter ? location : "United States",
            radiusMiles: useGeoFilter ? 100 : 0,
            concerts: [],
            concertsByMonth: {},
            totalConcerts: 0,
            artistsWithConcerts: 0,
            message: payload?.error || "Failed to fetch concert data.",
          });
        }
      } catch (error) {
        console.error("Failed to fetch concerts:", error);
        setData({
          location: searchUSA ? "United States" : location,
          radiusMiles: searchUSA ? 0 : 100,
          concerts: [],
          concertsByMonth: {},
          totalConcerts: 0,
          artistsWithConcerts: 0,
          message: "Failed to fetch concert data. Check your API key and try again.",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchConcerts();
  }, [location, artistQuery, searchUSA]);

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextLocation = inputLocation.trim();
    const nextArtist = inputArtist.trim();
    const shouldSearchUSA = searchUSA || (nextArtist && !nextLocation);

    setSearchUSA(shouldSearchUSA);
    setArtistQuery(nextArtist);
    setLocation(nextLocation);

    if (nextLocation) {
      localStorage.setItem("userLocation", nextLocation);
    } else {
      localStorage.removeItem("userLocation");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
    };
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-12 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Concert Recommendations</h1>
        <p className="text-muted-foreground mt-1">
          Upcoming shows for the artists you search, powered by ticketing partners and your location.
        </p>
      </div>

      <Card className="glass">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-spotify-green/10 p-2 text-spotify-green">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Artist match</p>
                <p className="text-sm text-muted-foreground">Upcoming concerts for the artists you search.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-spotify-green/10 p-2 text-spotify-green">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Ticketing integration</p>
                <p className="text-sm text-muted-foreground">
                  Jump straight to verified listings from ticketing services.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-spotify-green/10 p-2 text-spotify-green">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Location-based discovery</p>
                <p className="text-sm text-muted-foreground">
                  Find shows within your chosen radius and city.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Input */}
      <Card className="glass">
        <CardContent className="pt-6">
          <form onSubmit={handleLocationSubmit} className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Music className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search an artist or band"
                value={inputArtist}
                onChange={(e) => setInputArtist(e.target.value)}
                className="h-12 w-full rounded-lg bg-muted/50 border border-border pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
              />
            </div>
            <div className="relative flex-1 min-w-[220px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter your city (e.g., New York, NY)"
                value={inputLocation}
                onChange={(e) => setInputLocation(e.target.value)}
                disabled={Boolean(inputArtist.trim()) && searchUSA}
                className="h-12 w-full rounded-lg bg-muted/50 border border-border pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all disabled:opacity-60"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={searchUSA}
                onChange={(e) => setSearchUSA(e.target.checked)}
                className="h-4 w-4 rounded border border-border text-spotify-green focus:ring-spotify-green"
              />
              Search across the U.S.
            </label>
            <Button type="submit" className="bg-spotify-green hover:bg-spotify-green/90">
              <Search className="h-4 w-4 mr-2" />
              Find Concerts
            </Button>
          </form>
          {artistQuery && searchUSA ? (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Music className="h-4 w-4" />
              <span>
                Searching across the U.S. for:{" "}
                <strong className="text-foreground">{artistQuery}</strong>
              </span>
            </div>
          ) : !artistQuery ? (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Music className="h-4 w-4" />
              <span>Enter one or more artists to see concerts.</span>
            </div>
          ) : location ? (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Navigation className="h-4 w-4" />
              <span>
                Showing concerts within 100 miles of:{" "}
                <strong className="text-foreground">{location}</strong>
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data?.message ? (
        <Card className="glass">
          <CardContent className="py-12">
            <div className="text-center">
              <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{data.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : data && data.concerts.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12">
            <div className="text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No upcoming concerts found for these artists in this area.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Try a different location or check back later!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : data && (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Upcoming Concerts"
              value={data.totalConcerts.toString()}
              description="In the next 6 months"
              icon={Ticket}
            />
            <StatCard
              title="Artists Performing"
              value={data.artistsWithConcerts.toString()}
              description="From your top artists"
              icon={Music}
            />
            <StatCard
              title="Location"
              value={data.location}
              description={data.radiusMiles > 0 ? `${data.radiusMiles} miles` : "Nationwide"}
              icon={MapPin}
            />
          </div>

          {/* Concerts by Month */}
          {Object.entries(data.concertsByMonth).map(([month, concerts]) => (
            <div key={month} className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-spotify-green" />
                {month}
              </h2>
              <div className="space-y-3">
                {concerts.map((concert) => {
                  const dateInfo = formatDate(concert.date);
                  return (
                    <Card key={concert.id} className="glass hover:border-spotify-green/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Date Badge */}
                          <div className="flex-shrink-0 w-16 text-center">
                            <div className="bg-spotify-green/20 rounded-lg p-2">
                              <p className="text-xs text-spotify-green font-medium">{dateInfo.day}</p>
                              <p className="text-2xl font-bold">{dateInfo.date}</p>
                              <p className="text-xs text-muted-foreground">{dateInfo.month}</p>
                            </div>
                          </div>

                          {/* Artist Image */}
                          {concert.artistImageUrl ? (
                            <img
                              src={concert.artistImageUrl}
                              alt={concert.artistName}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                              <Music className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}

                          {/* Concert Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{concert.artistName}</h3>
                            <p className="text-sm text-muted-foreground truncate">{concert.venue}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {concert.city}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {concert.time}
                              </span>
                              <Badge variant="secondary">
                                {concert.distance == null ? "Distance unknown" : `${concert.distance} mi away`}
                              </Badge>
                            </div>
                          </div>

                          {/* Price and Tickets */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-lg font-bold text-spotify-green">{concert.price}</p>
                            <a
                              href={concert.ticketUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline" className="mt-2">
                                <Ticket className="h-4 w-4 mr-1" />
                                Tickets
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Disclaimer */}
          <Card className="glass border-spotify-green/30">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                <strong>Source:</strong> Concert data provided by Ticketmaster.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
