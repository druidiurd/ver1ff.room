import { Component, inject, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../store';

declare var L: any;

interface City { label: string; lat: number; lng: number; zoom?: number; }

const POPULAR: City[] = [
  { label: 'London',    lat: 51.5074,  lng: -0.1278,  zoom: 12 },
  { label: 'Paris',     lat: 48.8566,  lng:  2.3522,  zoom: 12 },
  { label: 'Berlin',    lat: 52.5200,  lng: 13.4050,  zoom: 12 },
  { label: 'Madrid',    lat: 40.4168,  lng: -3.7038,  zoom: 12 },
  { label: 'Rome',      lat: 41.9028,  lng: 12.4964,  zoom: 12 },
  { label: 'Amsterdam', lat: 52.3676,  lng:  4.9041,  zoom: 13 },
  { label: 'Warsaw',    lat: 52.2297,  lng: 21.0122,  zoom: 12 },
  { label: 'Lisbon',    lat: 38.7169,  lng: -9.1399,  zoom: 13 },
  { label: 'Dublin',    lat: 53.3498,  lng: -6.2603,  zoom: 13 },
  { label: 'Vienna',    lat: 48.2082,  lng: 16.3738,  zoom: 12 },
  { label: 'Prague',    lat: 50.0755,  lng: 14.4378,  zoom: 13 },
  { label: 'Budapest',  lat: 47.4979,  lng: 19.0402,  zoom: 12 },
  { label: 'Moscow',    lat: 55.7558,  lng: 37.6176,  zoom: 11 },
  { label: 'Istanbul',  lat: 41.0082,  lng: 28.9784,  zoom: 12 },
  { label: 'Dubai',     lat: 25.2048,  lng: 55.2708,  zoom: 12 },
  { label: 'New York',  lat: 40.7128,  lng: -74.0060, zoom: 12 },
  { label: 'Los Angeles', lat: 34.0522, lng: -118.2437, zoom: 11 },
  { label: 'Toronto',   lat: 43.6510,  lng: -79.3470, zoom: 12 },
  { label: 'Sydney',    lat: -33.8688, lng: 151.2093, zoom: 12 },
  { label: 'Tokyo',     lat: 35.6762,  lng: 139.6503, zoom: 12 },
  { label: 'Singapore', lat:  1.3521,  lng: 103.8198, zoom: 12 },
  { label: 'Bangkok',   lat: 13.7563,  lng: 100.5018, zoom: 12 },
  { label: 'Cairo',     lat: 30.0444,  lng: 31.2357,  zoom: 12 },
  { label: 'Nairobi',   lat: -1.2921,  lng: 36.8219,  zoom: 12 },
];

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="map-shell">

      <!-- Search bar -->
      <div class="map-search-row">
        <input
          class="map-search-inp mono"
          [(ngModel)]="query"
          (keydown.enter)="search()"
          placeholder="SEARCH CITY OR COUNTRY..."
          autocomplete="off"
        />
        <button class="map-search-btn mono" (click)="search()" [disabled]="searching()">
          {{ searching() ? '...' : '⌕ GO' }}
        </button>
      </div>

      @if (searchErr()) {
        <div class="map-search-err mono">{{ searchErr() }}</div>
      }

      <!-- Popular cities -->
      <div class="map-chips-row">
        @for (c of popular; track c.label) {
          <button class="map-chip mono" (click)="flyTo(c)">{{ c.label }}</button>
        }
      </div>

      <!-- Map -->
      <div class="map-container">
        <div id="geo-map"></div>
        <div class="map-overlay mono">GEO_SYNC_ACTIVE</div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .map-shell { display: flex; flex-direction: column; gap: 10px; height: 100%; }

    /* Search */
    .map-search-row { display: flex; gap: 8px; }
    .map-search-inp {
      flex: 1; background: rgba(0,0,0,0.5); border: 1px solid rgba(0,255,65,0.25);
      border-radius: var(--radius-sm); padding: 9px 14px;
      color: #00ff41; font-size: 0.65rem; font-weight: 700; letter-spacing: 1px;
      outline: none; transition: border-color 0.15s;
    }
    .map-search-inp:focus { border-color: #00ff41; }
    .map-search-inp::placeholder { color: rgba(0,255,65,0.2); }
    .map-search-btn {
      background: rgba(0,255,65,0.08); border: 1px solid rgba(0,255,65,0.35);
      color: #00ff41; font-size: 0.6rem; font-weight: 800; letter-spacing: 1.5px;
      padding: 9px 16px; border-radius: var(--radius-sm); cursor: pointer;
      transition: 0.15s; white-space: nowrap;
    }
    .map-search-btn:hover:not(:disabled) { background: rgba(0,255,65,0.18); }
    .map-search-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .map-search-err { font-size: 0.55rem; color: #ff3b30; letter-spacing: 1px; padding: 2px 4px; }

    /* Chips */
    .map-chips-row {
      display: flex; gap: 6px; flex-wrap: wrap;
      max-height: 72px; overflow-y: auto;
    }
    .map-chip {
      background: rgba(0,0,0,0.4); border: 1px solid rgba(0,255,65,0.2);
      color: rgba(0,255,65,0.7); font-size: 0.5rem; font-weight: 700;
      letter-spacing: 0.5px; padding: 5px 10px; border-radius: 20px;
      cursor: pointer; white-space: nowrap; transition: 0.15s;
    }
    .map-chip:hover { border-color: #00ff41; color: #00ff41; background: rgba(0,255,65,0.08); }

    /* Map */
    .map-container {
      position: relative; flex: 1; min-height: 280px;
      border-radius: var(--radius); overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
    }
    #geo-map { width: 100%; height: 100%; background: #0a0a0a; }
    .map-overlay {
      position: absolute; top: 12px; right: 12px;
      background: rgba(0,0,0,0.85); color: #00ff41;
      padding: 4px 10px; font-size: 0.55rem; font-weight: 900;
      border-radius: 6px; border: 1px solid #00ff41; z-index: 1000;
      letter-spacing: 1.5px;
    }
  `]
})
export class MapComponent implements AfterViewInit, OnDestroy {
  store = inject(AppStore);
  popular = POPULAR;
  query = '';
  searching = signal(false);
  searchErr = signal('');

  private map: any;
  private marker: any;

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }

  private initMap() {
    this.map = L.map('geo-map', { zoomControl: true }).setView([48.8566, 2.3522], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.map);

    this.map.on('click', (e: any) => {
      this.placeMarker(e.latlng.lat, e.latlng.lng);
    });
  }

  private placeMarker(lat: number, lng: number) {
    if (this.marker) this.marker.setLatLng([lat, lng]);
    else this.marker = L.marker([lat, lng]).addTo(this.map);
    const current = this.store.lines();
    current[0] = lat.toFixed(6);
    current[1] = lng.toFixed(6);
    this.store.lines.set([...current]);
  }

  flyTo(city: City) {
    if (!this.map) return;
    this.map.flyTo([city.lat, city.lng], city.zoom ?? 12, { duration: 1.2 });
    this.placeMarker(city.lat, city.lng);
  }

  async search() {
    const q = this.query.trim();
    if (!q || this.searching()) return;
    this.searching.set(true);
    this.searchErr.set('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (!data.length) { this.searchErr.set('NOT FOUND'); return; }
      const { lat, lon } = data[0];
      const latN = parseFloat(lat);
      const lonN = parseFloat(lon);
      this.map.flyTo([latN, lonN], 12, { duration: 1.2 });
      this.placeMarker(latN, lonN);
    } catch {
      this.searchErr.set('SEARCH ERROR');
    } finally {
      this.searching.set(false);
    }
  }
}
