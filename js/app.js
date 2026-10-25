/**
 * TPE-HoliPop - Frontend Application
 * Taipei Weekend & Holiday Radar Web App
 */

// Category UI Configuration
const CATEGORIES = {
  family:   { label: "👨‍👩‍👧 親子", color: "#fb923c", key: "親子" },
  market:   { label: "🎪 市集", color: "#f59e0b", key: "市集" },
  outdoor:  { label: "🌳 戶外", color: "#22c55e", key: "戶外" },
  festival: { label: "🏮 節慶", color: "#f43f5e", key: "節慶" },
  party:    { label: "🎉 派對", color: "#ec4899", key: "派對" },
  popup:    { label: "⚡ 快閃", color: "#3b82f6", key: "popup" },
  anime:    { label: "✨ 動漫", color: "#a855f7", key: "anime" },
  food:     { label: "🍔 美食", color: "#f97316", key: "food" },
};

function getCategoryInfo(cat) {
  if (cat === "food" || cat === "美食") return CATEGORIES.food;
  if (CATEGORIES[cat]) return CATEGORIES[cat];
  for (const [k, v] of Object.entries(CATEGORIES)) {
    if (v.key === cat || v.label.includes(cat)) return v;
  }
  return { label: cat, color: "#64748b", key: cat };
}

// Hotspot zones configuration
const ZONES = {
  huashan:  { lat: 25.0446, lng: 121.5292, zoom: 16 },
  songshan: { lat: 25.0437, lng: 121.5608, zoom: 16 },
  expopark: { lat: 25.0706, lng: 121.5218, zoom: 16 },
  xinyi:    { lat: 25.0366, lng: 121.5672, zoom: 16 },
  nanxi:    { lat: 25.0524, lng: 121.5221, zoom: 16 },
  ximen:    { lat: 25.0435, lng: 121.5072, zoom: 16 },
  banqiao:  { lat: 25.0136, lng: 121.4652, zoom: 16 },
};

class HoliPopApp {
  constructor() {
    this.events = [];
    this.markersMap = new Map(); // id -> L.marker
    this.clusterGroup = null;
    this.map = null;

    // Filters State
    this.state = {
      timeScope: "weekend", // 'weekend' | 'holiday' | 'all'
      category: "all",
      searchQuery: "",
      selectedId: null,
      drawerOpen: window.innerWidth > 992,
    };

    this.init();
  }

  async init() {
    this.initMap();
    this.bindEvents();
    await this.loadData();
    this.render();
  }

  /* ==========================================================================
     Map Initialization
     ========================================================================== */
  initMap() {
    // Default center around central Taipei
    this.map = L.map("map", {
      center: [25.0425, 121.5385],
      zoom: 13,
      zoomControl: false,
    });

    // Zoom controls at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(this.map);

    // Esri World Dark Gray Canvas (High contrast, zero watermarks, no API key needed)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; TPE-HoliPop',
      maxZoom: 16,
    }).addTo(this.map);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
    }).addTo(this.map);

    // Marker Cluster Group
    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 36,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let sizeClass = "marker-cluster-small";
        if (count > 15) sizeClass = "marker-cluster-large";
        else if (count > 6) sizeClass = "marker-cluster-medium";

        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster ${sizeClass}`,
          iconSize: L.point(40, 40),
        });
      },
    });

    this.map.addLayer(this.clusterGroup);
  }

  /* ==========================================================================
     Data Loading
     ========================================================================== */
  async loadData() {
    try {
      const resp = await fetch(`data/events.geojson?t=${Date.now()}`, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.events = data.features || [];

      // 依照 period.start 降冪排序（最新活動排最前，長駐舊活動往後擺；若 start 相同則依 end 降冪）
      this.events.sort((a, b) => {
        const startA = a.properties?.period?.start || "";
        const startB = b.properties?.period?.start || "";
        if (startB !== startA) {
          return startB.localeCompare(startA);
        }
        const endA = a.properties?.period?.end || "";
        const endB = b.properties?.period?.end || "";
        return endB.localeCompare(endA);
      });

      console.log(`Loaded ${this.events.length} holiday events.`);

      // Update data freshness indicator
      const meta = data.metadata || {};
      if (meta.generated_at) {
        const dt = new Date(meta.generated_at);
        const formatted = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        const updatedEl = document.getElementById("brand-updated");
        if (updatedEl) {
          updatedEl.textContent = `更新於 ${formatted}`;
          updatedEl.title = `資料最後自動同步時間：${dt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`;
        }
      }
    } catch (err) {
      console.error("Failed to load events.geojson:", err);
      this.events = [];
    }
  }

  /* ==========================================================================
     Filtering Logic (Supports Composite Tags)
     ========================================================================== */
  getFilteredEvents() {
    return this.events.filter((item) => {
      const p = item.properties;
      const tags = p.tags || [];

      // 1. Time Scope Filter
      if (this.state.timeScope === "weekend") {
        if (!tags.includes("本週末")) return false;
      } else if (this.state.timeScope === "holiday") {
        const hasLongHoliday = tags.some((t) => t.includes("連假") || (!["本週末", "下週末"].includes(t)));
        if (!hasLongHoliday) return false;
      }

      // 2. Category Filter (Supports multi-tags matching)
      if (this.state.category !== "all") {
        const target = this.state.category;
        const targetCfg = CATEGORIES[target];
        const targetKey = targetCfg ? targetCfg.key : target;

        const eventCats = p.categories && p.categories.length > 0 ? p.categories : [p.category];
        const matched = eventCats.some((c) => {
          return c === target || c === targetKey || (target === "food" && (c === "food" || c === "美食"));
        });
        if (!matched) return false;
      }

      // 3. Search Query
      if (this.state.searchQuery.trim()) {
        const q = this.state.searchQuery.toLowerCase();
        const catsText = (p.categories || []).join(" ");
        const content = `${p.title} ${p.venue_name} ${p.summary} ${catsText}`.toLowerCase();
        if (!content.includes(q)) return false;
      }

      return true;
    });
  }

  /* ==========================================================================
     Rendering Pipeline
     ========================================================================== */
  render() {
    const filtered = this.getFilteredEvents();
    this.updateCounters();
    this.renderMapMarkers(filtered);
    this.renderDrawerList(filtered);
  }

  updateCounters() {
    // Weekend count
    const weekendCount = this.events.filter((e) => (e.properties.tags || []).includes("本週末")).length;
    // Holiday count
    const holidayCount = this.events.filter((e) => (e.properties.tags || []).some((t) => t.includes("連假") || (!["本週末", "下週末"].includes(t)))).length;
    // Total count
    const totalCount = this.events.length;

    const elWeekend = document.getElementById("count-weekend");
    const elHoliday = document.getElementById("count-holiday");
    const elAll = document.getElementById("count-all");
    if (elWeekend) elWeekend.textContent = weekendCount;
    if (elHoliday) elHoliday.textContent = holidayCount;
    if (elAll) elAll.textContent = totalCount;

    // Current Scope Events for category counts
    const currentScopeEvents = this.events.filter((item) => {
      const tags = item.properties.tags || [];
      if (this.state.timeScope === "weekend") return tags.includes("本週末");
      if (this.state.timeScope === "holiday") return tags.some((t) => t.includes("連假") || (!["本週末", "下週末"].includes(t)));
      return true;
    });

    const elCatAll = document.getElementById("cat-count-all");
    if (elCatAll) elCatAll.textContent = currentScopeEvents.length;

    // Count for each category pill
    for (const [catKey, catCfg] of Object.entries(CATEGORIES)) {
      const tagKey = catCfg.key;
      const count = currentScopeEvents.filter((e) => {
        const p = e.properties;
        const cats = p.categories && p.categories.length > 0 ? p.categories : [p.category];
        return cats.includes(tagKey) || cats.includes(catKey) || (catKey === "festival" && cats.includes("event"));
      }).length;

      const el = document.getElementById(`cat-count-${catKey}`);
      if (el) el.textContent = count;
    }
  }

  /* ==========================================================================
     Map Markers Rendering
     ========================================================================== */
  renderMapMarkers(filteredEvents) {
    this.clusterGroup.clearLayers();
    this.markersMap.clear();

    filteredEvents.forEach((feature) => {
      const p = feature.properties;
      const id = feature.id;
      const [lon, lat] = feature.geometry.coordinates;
      const catInfo = getCategoryInfo(p.category);
      const catClass = catInfo.key || p.category;

      const customIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<div class="custom-pin ${catClass}" data-id="${id}"><div class="pin-inner"></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([lat, lon], { icon: customIcon });

      const popupContent = this.createPopupContent(feature);
      marker.bindPopup(popupContent, { maxWidth: 320, className: "custom-leaflet-popup" });

      marker.on("click", () => {
        this.selectEvent(id, false);
      });

      this.clusterGroup.addLayer(marker);
      this.markersMap.set(id, marker);
    });
  }

  createPopupContent(feature) {
    const p = feature.properties;
    const [lon, lat] = feature.geometry.coordinates;
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    
    // Multiple Tag Badges
    const badgesHtml = (p.categories && p.categories.length > 0 ? p.categories : [p.category])
      .map((c) => {
        const info = getCategoryInfo(c);
        return `<span class="cat-badge ${info.key || c}">${info.label}</span>`;
      })
      .join(" ");

    const tagsHtml = (p.tags || []).map((t) => `<span class="tag-weekend">${t}</span>`).join(" ");

    return `
      <div class="popup-inner">
        <div class="badge-tag-wrap" style="margin-bottom: 4px;">
          ${badgesHtml}
          ${tagsHtml}
        </div>
        ${p.image_url ? `<div class="popup-thumb" style="background-image: url('${p.image_url}')"></div>` : ""}
        <div class="popup-title">${p.title}</div>
        <div class="popup-venue">📍 ${p.venue_name}</div>
        <div class="popup-period">📅 ${p.period.start} ~ ${p.period.end}</div>
        ${p.summary ? `<div class="card-summary" style="margin-top:2px;">${p.summary}</div>` : ""}
        <div class="popup-actions">
          <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" class="action-link link-map">
            🧭 導航
          </a>
          ${
            p.source_url
              ? `<a href="${p.source_url}" target="_blank" rel="noopener noreferrer" class="action-link link-external">官方詳情 ↗</a>`
              : ""
          }
        </div>
      </div>
    `;
  }

  renderDrawerList(filteredEvents) {
    const listContainer = document.getElementById("events-list-container");
    const countEl = document.getElementById("drawer-event-count");
    const titleEl = document.getElementById("drawer-view-title");

    countEl.textContent = filteredEvents.length;

    if (this.state.timeScope === "weekend") {
      titleEl.textContent = "本週末精選假日活動";
    } else if (this.state.timeScope === "holiday") {
      titleEl.textContent = "近期連假精選活動";
    } else {
      titleEl.textContent = "雙北全部假日活動";
    }

    if (filteredEvents.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding: 40px 10px; color: var(--text-dim);">
          <div style="font-size: 2rem; margin-bottom: 10px;">🔍</div>
          <div>找不到符合條件的假日活動</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">嘗試切換上方分類或清除搜尋關鍵字</div>
        </div>
      `;
      return;
    }

    const cardsHtml = filteredEvents
      .map((feature) => {
        const p = feature.properties;
        const id = feature.id;
        const isSelected = this.state.selectedId === id;
        const [lon, lat] = feature.geometry.coordinates;
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
        
        // Multi-tag badges
        const badgesHtml = (p.categories && p.categories.length > 0 ? p.categories : [p.category])
          .map((c) => {
            const info = getCategoryInfo(c);
            return `<span class="cat-badge ${info.key || c}">${info.label}</span>`;
          })
          .join(" ");

        const tagsHtml = (p.tags || []).map((t) => `<span class="tag-weekend">${t}</span>`).join(" ");

        return `
          <div class="event-card ${isSelected ? "selected" : ""}" data-id="${id}">
            <div class="card-top">
              <div class="badge-tag-wrap">
                ${badgesHtml}
                ${tagsHtml}
              </div>
              <span class="card-period">${p.period.start.slice(5)} ~ ${p.period.end.slice(5)}</span>
            </div>
            ${p.image_url ? `<div class="card-thumb" style="background-image: url('${p.image_url}')"></div>` : ""}
            <h3 class="card-title">${p.title}</h3>
            <div class="card-venue">📍 ${p.venue_name}</div>
            ${p.summary ? `<div class="card-summary">${p.summary}</div>` : ""}
            <div class="card-actions">
              <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" class="action-link link-map" onclick="event.stopPropagation()">
                🧭 Google導航
              </a>
              ${
                p.source_url
                  ? `<a href="${p.source_url}" target="_blank" rel="noopener noreferrer" class="action-link link-external" onclick="event.stopPropagation()">詳情 ↗</a>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    listContainer.innerHTML = cardsHtml;

    // Card click events
    listContainer.querySelectorAll(".event-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        this.selectEvent(id, true);
      });
    });
  }

  /* ==========================================================================
     Event Selection & Map FlyTo
     ========================================================================== */
  selectEvent(id, panMap = true) {
    this.state.selectedId = id;

    // Highlight card in drawer
    document.querySelectorAll(".event-card").forEach((card) => {
      if (card.dataset.id === id) {
        card.classList.add("selected");
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        card.classList.remove("selected");
      }
    });

    const marker = this.markersMap.get(id);
    if (!marker) return;

    if (panMap) {
      const latLng = marker.getLatLng();
      this.map.flyTo(latLng, 16, { duration: 0.8 });
      // Uncluster if needed and open popup
      setTimeout(() => {
        this.clusterGroup.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      }, 400);
    }
  }

  /* ==========================================================================
     UI Event Bindings
     ========================================================================== */
  bindEvents() {
    // Time Scope Switcher
    const timeGroup = document.getElementById("time-filter-group");
    timeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".time-pill-btn");
      if (!btn) return;
      timeGroup.querySelectorAll(".time-pill-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      this.state.timeScope = btn.dataset.time;
      this.state.selectedId = null;
      this.render();
    });

    // Category Filter Buttons
    const catBar = document.getElementById("category-filter-bar");
    catBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-btn");
      if (!btn) return;
      catBar.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      this.state.category = btn.dataset.cat;
      this.state.selectedId = null;
      this.render();
    });

    // Search Input with Debounce
    const searchInput = document.getElementById("search-input");
    let searchTimeout = null;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.state.searchQuery = e.target.value;
        this.state.selectedId = null;
        this.render();
      }, 200);
    });

    // Hotspot Zones
    const zonesBar = document.getElementById("quick-zones-bar");
    zonesBar.addEventListener("click", (e) => {
      const chip = e.target.closest(".zone-chip");
      if (!chip) return;
      zonesBar.querySelectorAll(".zone-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const zoneKey = chip.dataset.zone;
      const zone = ZONES[zoneKey];
      if (zone) {
        this.map.flyTo([zone.lat, zone.lng], zone.zoom, { duration: 1.0 });
      }
    });

    // Drawer Toggle
    const drawer = document.getElementById("sidebar-drawer");
    const toggleBtn = document.getElementById("btn-toggle-drawer");
    const closeBtn = document.getElementById("btn-close-drawer");

    const toggleDrawer = () => {
      drawer.classList.toggle("closed");
    };

    toggleBtn.addEventListener("click", toggleDrawer);
    closeBtn.addEventListener("click", () => drawer.classList.add("closed"));

    // Brand Logo click -> Reset view
    document.getElementById("brand-home").addEventListener("click", () => {
      this.map.flyTo([25.0425, 121.5385], 13, { duration: 0.8 });
    });

    // Locate Me
    document.getElementById("btn-locate").addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("您的瀏覽器不支援定位功能");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.map.flyTo([lat, lng], 15, { duration: 1.0 });

          // Add user location marker
          const userIcon = L.divIcon({
            className: "user-loc-icon",
            html: '<div style="width:16px;height:16px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 0 16px #38bdf8;"></div>',
            iconSize: [16, 16],
          });
          L.marker([lat, lng], { icon: userIcon }).addTo(this.map).bindPopup("📍 您的目前位置").openPopup();
        },
        () => {
          alert("無法取得您的目前位置，請確認瀏覽器已允許定位權限");
        }
      );
    });
  }
}

// Bootstrap
window.addEventListener("DOMContentLoaded", () => {
  window.app = new HoliPopApp();
});
