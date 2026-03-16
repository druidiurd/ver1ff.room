import { Component, inject, AfterViewInit, OnDestroy } from '@angular/core';
import { AppStore } from '../store';

declare var L: any;

@Component({
  selector: 'app-map',
  standalone: true,
  template: `<div id="geo-map"></div><div class="map-overlay">GEO_SYNC_ACTIVE</div>`,
  styles: [`
    :host { display: block; position: relative; height: 100%; min-height: 350px; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
    #geo-map { width: 100%; height: 100%; background: #0a0a0a; }
    .map-overlay { position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.8); color: #00ff41; padding: 5px 12px; font-size: 0.6rem; font-weight: 900; border-radius: 8px; border: 1px solid #00ff41; z-index: 1000; }
  `]
})
export class MapComponent implements AfterViewInit, OnDestroy {
  store = inject(AppStore);
  private map: any;
  private marker: any;

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }

  private initMap() {
    this.map = L.map('geo-map', { zoomControl: false }).setView([53.3498, -6.2603], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.map);
    
    this.map.on('click', (e: any) => {
      if (this.marker) this.marker.setLatLng(e.latlng); 
      else this.marker = L.marker(e.latlng).addTo(this.map);
      
      const current = this.store.lines();
      current[0] = e.latlng.lat.toFixed(6);
      current[1] = e.latlng.lng.toFixed(6);
      this.store.lines.set([...current]);
    });
  }
}