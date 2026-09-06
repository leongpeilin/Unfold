import { LocationTag } from "../types";

// 1. Direct REST API Batch Sync to Google Calendar
export async function syncMilestonesToGoogleCalendar(
  milestones: Array<{ stepTitle: string; suggestedDate?: string; details?: string }>,
  goalTitle: string
): Promise<{ success: boolean; syncedCount: number }> {
  const token = sessionStorage.getItem("gcal_access_token");
  if (!token) {
    throw new Error(
      "Calendar authorization missing. Please sign out and sign in again to grant calendar permissions."
    );
  }

  let syncedCount = 0;
  for (const m of milestones) {
    let startIso: string;
    let endIso: string;

    if (m.suggestedDate && !isNaN(new Date(m.suggestedDate).getTime())) {
      const target = new Date(m.suggestedDate);
      target.setHours(9, 0, 0, 0);
      const targetEnd = new Date(target.getTime() + 60 * 60000);
      startIso = target.toISOString();
      endIso = targetEnd.toISOString();
    } else {
      const target = new Date();
      target.setDate(target.getDate() + 7);
      target.setHours(9, 0, 0, 0);
      const targetEnd = new Date(target.getTime() + 60 * 60000);
      startIso = target.toISOString();
      endIso = targetEnd.toISOString();
    }

    const eventPayload = {
      summary: `Goal: ${m.stepTitle}`,
      description: `${m.details || ""}\n\nLinked Goal: ${goalTitle}\nManaged via Unfold`,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
    };

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || "Failed to post milestone event to Google Calendar."
      );
    }
    syncedCount++;
  }

  return { success: true, syncedCount };
}

// 2. Google Calendar Fallback Link Generator for Action Items
export function createGoogleCalendarUrl(actionItem: string, reflectionTitle: string): string {
  const title = encodeURIComponent(`Unfold Action: ${actionItem}`);
  const details = encodeURIComponent(
    `Mindful action item from your Unfold session: "${reflectionTitle}"\n\nTake a breath and make progress!`
  );
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 45 * 60000);

  const formatIso = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const dates = `${formatIso(start)}/${formatIso(end)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
}

// 3. Google Calendar Fallback Link Generator for Individual Goal Milestones
export function createGoalMilestoneCalendarUrl(
  milestoneTitle: string,
  suggestedDate: string,
  detailsText: string,
  goalTitle: string
): string {
  const title = encodeURIComponent(`Goal Milestone: ${milestoneTitle}`);
  const details = encodeURIComponent(
    `Goal: ${goalTitle}\n\nMilestone Details: ${detailsText}\n\nGenerated via Unfold Goal Strategist.`
  );

  let start = new Date();
  if (suggestedDate && !isNaN(new Date(suggestedDate).getTime())) {
    start = new Date(suggestedDate);
    start.setHours(10, 0, 0, 0);
  } else {
    start.setDate(start.getDate() + 7);
    start.setHours(10, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 60 * 60000);

  const formatIso = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const dates = `${formatIso(start)}/${formatIso(end)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
}

// 4. Geolocation Browser Tagging Fallback
export async function getCurrentBrowserLocation(): Promise<LocationTag> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          name: `Beach Sanctuary (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => reject(err),
      { timeout: 10000 }
    );
  });
}

// 5. Cosine Similarity for Semantic Search
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 6. Dynamic Google Places Script Loader
let googleMapsLoadingPromise: Promise<any> | null = null;
function loadGoogleMapsScript(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).google?.maps?.places) return Promise.resolve((window as any).google.maps);
  if (googleMapsLoadingPromise) return googleMapsLoadingPromise;

  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey.includes("MY_") || apiKey.includes("%")) {
    return Promise.resolve(null);
  }

  googleMapsLoadingPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve((window as any).google?.maps || null);
    script.onerror = () => {
      console.warn("Google Maps script failed to load; using POI fallback.");
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadingPromise;
}

// 7. Comprehensive Location & Venue Search Engine (Google Places with Nominatim / Photon Fallbacks)
export async function searchLocations(
  query: string,
  countryCode: string = "SG"
): Promise<Array<{ name: string; lat: number; lng: number }>> {
  if (!query || query.trim().length < 2) return [];
  const cleanQuery = query.trim();

  // Tier 1: Google Places Autocomplete API
  try {
    const maps = await loadGoogleMapsScript();
    if (maps && maps.places) {
      const googleResults = await new Promise<Array<{ name: string; lat: number; lng: number }>>(
        (resolve) => {
          const service = new maps.places.AutocompleteService();
          service.getPlacePredictions(
            {
              input: cleanQuery,
              componentRestrictions: countryCode !== "ALL" ? { country: countryCode.toLowerCase() } : undefined,
            },
            async (predictions: any[], status: string) => {
              if (
                status !== maps.places.PlacesServiceStatus.OK ||
                !predictions ||
                predictions.length === 0
              ) {
                resolve([]);
                return;
              }
              const placesService = new maps.places.PlacesService(document.createElement("div"));
              const detailPromises = predictions.slice(0, 6).map((pred: any) => {
                return new Promise<{ name: string; lat: number; lng: number } | null>(
                  (resDetail) => {
                    placesService.getDetails(
                      {
                        placeId: pred.place_id,
                        fields: ["name", "geometry", "formatted_address"],
                      },
                      (place: any, detailStatus: string) => {
                        if (
                          detailStatus === maps.places.PlacesServiceStatus.OK &&
                          place?.geometry?.location
                        ) {
                          const lat = place.geometry.location.lat();
                          const lng = place.geometry.location.lng();
                          const title = place.name || pred.description;
                          const subtitle = place.formatted_address
                            ? ` • ${place.formatted_address.split(",")[0]}`
                            : "";
                          resDetail({ name: `${title}${subtitle}`, lat, lng });
                        } else {
                          resDetail(null);
                        }
                      }
                    );
                  }
                );
              });
              const resolved = await Promise.all(detailPromises);
              resolve(
                resolved.filter(
                  (item): item is { name: string; lat: number; lng: number } => item !== null
                )
              );
            }
          );
        }
      );
      if (googleResults.length > 0) return googleResults;
    }
  } catch (err) {
    console.warn("Google Places lookup error:", err);
  }

  // Tier 2: Nominatim OpenStreetMap Search with Country Code Filtering
  try {
    const countryParam = countryCode !== "ALL" ? `&countrycodes=${countryCode.toLowerCase()}` : "";
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        cleanQuery
      )}${countryParam}&format=json&addressdetails=1&limit=8`,
      { headers: { "Accept-Language": "en" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          name: item.display_name.split(",").slice(0, 2).join(", "),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
      }
    }
  } catch (err) {
    console.warn("Nominatim search error:", err);
  }

  // Tier 3: Photon POI Engine Fallback
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(
        cleanQuery + (countryCode === "SG" ? " Singapore" : "")
      )}&limit=8`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        return data.features.map((feat: any) => {
          const props = feat.properties || {};
          const name = props.name || cleanQuery;
          const city = props.city || props.town || props.district || props.county || "";
          const country = props.country || "";
          let label = name;
          if (city && !name.toLowerCase().includes(city.toLowerCase())) {
            label = `${name} • ${city}`;
          } else if (country && !name.toLowerCase().includes(country.toLowerCase())) {
            label = `${name} • ${country}`;
          }
          const [lng, lat] = feat.geometry.coordinates;
          return { name: label, lat, lng };
        });
      }
    }
  } catch (err) {
    console.warn("Photon POI fallback error:", err);
  }

  return [];
}