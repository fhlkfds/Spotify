"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  distance: number;
}

interface ConcertsData {
  location: string;
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

  // Load location from localStorage on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem("userLocation");
    if (savedLocation) {
      setLocation(savedLocation);
      setInputLocation(savedLocation);
    } else {
      setLocation("New York, NY");
      setInputLocation("New York, NY");
    }
  }, []);

  // Fetch concerts when location changes
  useEffect(() => {
    if (!location) return;

    async function fetchConcerts() {
      try {
        setLoading(true);
        const res = await fetch(`/api/concerts?location=${encodeURIComponent(location)}`);
        if (res.ok) {
          const concertsData = await res.json();
          setData(concertsData);
        }
      } catch (error) {
        console.error("Failed to fetch concerts:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchConcerts();
  }, [location]);

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputLocation.trim()) {
      localStorage.setItem("userLocation", inputLocation.trim());
      setLocation(inputLocation.trim());
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
          Upcoming concerts from artists you listen to
        </p>
      </div>

      {/* Location Input */}
      <Card className="glass">
        <CardContent className="pt-6">
          <form onSubmit={handleLocationSubmit} className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter your city (e.g., New York, NY)"
                value={inputLocation}
                onChange={(e) => setInputLocation(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" className="bg-spotify-green hover:bg-spotify-green/90">
              <Search className="h-4 w-4 mr-2" />
              Find Concerts
            </Button>
          </form>
          {location && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Navigation className="h-4 w-4" />
              <span>Showing concerts near: <strong className="text-foreground">{location}</strong></span>
            </div>
          )}
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
                No upcoming concerts found for your top artists in this area.
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
              description="In the next 90 days"
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
              description="Search area"
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
                              <Badge variant="secondary">{concert.distance} mi away</Badge>
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
          <Card className="glass border-yellow-500/30">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                <strong>Note:</strong> Concert data is simulated for demonstration purposes.
                In production, this would integrate with Ticketmaster, Songkick, or Bandsintown APIs.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
