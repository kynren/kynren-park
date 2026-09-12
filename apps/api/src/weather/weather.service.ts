import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Fallback: Kynren, Bishop Auckland — used whenever the admin map hasn't set
// an explicit centre point yet (same default already used for new facilities).
const DEFAULT_LAT = 54.6715;
const DEFAULT_LNG = -1.6785;

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedWeather {
  fetchedAt: number;
  data: unknown;
}

/**
 * Current + hourly weather via Open-Meteo (no API key required). Cached
 * in-memory for ~10 minutes to stay polite to the free API.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private cache: CachedWeather | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async coords(): Promise<{ lat: number; lng: number }> {
    const config = await this.prisma.mapConfig.findFirst();
    return {
      lat: config?.centerLat ?? DEFAULT_LAT,
      lng: config?.centerLng ?? DEFAULT_LNG,
    };
  }

  async current() {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }
    const { lat, lng } = await this.coords();
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m,precipitation');
    url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', 'Europe/London');

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
      const data = await res.json();
      this.cache = { fetchedAt: Date.now(), data };
      return data;
    } catch (e) {
      this.logger.error(`Weather fetch failed: ${(e as Error).message}`);
      if (this.cache) return this.cache.data; // serve stale rather than nothing
      throw e;
    }
  }
}
