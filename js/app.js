/**
 * TPE-HoliPop - Frontend Application
 * Taipei Weekend & Holiday Radar Web App
 */

// Statutory & Long Weekend Calendar
const TAIWAN_HOLIDAYS = [
  // 2026
  ["2026-01-01", "2026-01-04", "元旦連假"],
  ["2026-02-14", "2026-02-22", "農曆春節連假"],
  ["2026-02-27", "2026-03-01", "228連假"],
  ["2026-04-03", "2026-04-06", "清明兒童連假"],
  ["2026-05-01", "2026-05-03", "勞動節連假"],
  ["2026-06-19", "2026-06-21", "端午節連假"],
  ["2026-09-25", "2026-09-28", "中秋節與教師節連假"],
  ["2026-10-09", "2026-10-11", "國慶日連假"],
  ["2026-10-24", "2026-10-26", "光復節連假"],
  ["2026-12-25", "2026-12-27", "行憲紀念日連假"],
  ["2026-12-31", "2027-01-03", "跨年元旦連假"],
  // 2027
  ["2027-01-01", "2027-01-03", "元旦連假"],
  ["2027-02-04", "2027-02-10", "農曆春節連假"],
  ["2027-02-27", "2027-03-01", "228連假"],
  ["2027-04-03", "2027-04-06", "清明兒童連假"],
  ["2027-04-30", "2027-05-02", "勞動節連假"],
  ["2027-06-09", "2027-06-09", "端午節連假"],
  ["2027-09-15", "2027-09-15", "中秋節連假"],
  ["2027-10-09", "2027-10-11", "國慶日連假"],
  ["2027-10-23", "2027-10-25", "光復節連假"],
  ["2027-12-24", "2027-12-26", "行憲紀念日連假"],
  ["2027-12-31", "2028-01-02", "元旦連假"],
];

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
    this.dateOptions = [];

    // Filters State
    this.state = {
      timeScope: "all", // date string e.g. '2026-10-26' or 'all'
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

      // Resolve dynamic date options based on data generated_at / today
      this.dateOptions = this.resolveDateOptions(meta.generated_at);
      if (this.state.timeScope === "all" || !this.dateOptions.some((o) => o.key === this.state.timeScope)) {
        this.state.timeScope = this.dateOptions[0].key;
      }
      this.renderTimeFilterGroup();
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
     Dynamic Date Option Resolution
     ========================================================================== */
  resolveDateOptions(metaGeneratedAt) {
    let todayStr;
    if (metaGeneratedAt) {
      todayStr = metaGeneratedAt.slice(0, 10);
    } else {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const tpe = new Date(utc + 3600000 * 8);
      const y = tpe.getFullYear();
      const m = String(tpe.getMonth() + 1).padStart(2, "0");
      const d = String(tpe.getDate()).padStart(2, "0");
      todayStr = `${y}-${m}-${d}`;
    }

    const dateSet = new Set();
    const today = new Date(todayStr + "T00:00:00");
    const day = today.getDay(); // 0 is Sun, 6 is Sat

    const isHoliday = (dStr) => {
      const dt = new Date(dStr + "T00:00:00");
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) return true;
      return TAIWAN_HOLIDAYS.some(([s, e]) => s <= dStr && e >= dStr);
    };

    const addDays = (dStr, n) => {
      const dt = new Date(dStr + "T00:00:00");
      dt.setDate(dt.getDate() + n);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    // If today is a holiday/weekend, include today
    if (isHoliday(todayStr)) {
      dateSet.add(todayStr);
    }

    // Find upcoming weekend
    let satStr, sunStr;
    if (day === 6) {
      satStr = todayStr;
      sunStr = addDays(todayStr, 1);
    } else if (day === 0) {
      satStr = addDays(todayStr, 6);
      sunStr = addDays(todayStr, 7);
    } else {
      const daysToSat = 6 - day;
      satStr = addDays(todayStr, daysToSat);
      sunStr = addDays(todayStr, daysToSat + 1);
    }

    // Check Friday before Saturday (e.g. 3-day long weekend)
    const friStr = addDays(satStr, -1);
    if (isHoliday(friStr) && friStr >= todayStr) {
      dateSet.add(friStr);
    }

    if (satStr >= todayStr) dateSet.add(satStr);
    if (sunStr >= todayStr) dateSet.add(sunStr);

    // Check Monday after Sunday (e.g. 3-day long weekend)
    const monStr = addDays(sunStr, 1);
    if (isHoliday(monStr) && monStr >= todayStr) {
      dateSet.add(monStr);
    }

    const formatDateLabel = (dStr) => {
      const dt = new Date(dStr + "T00:00:00");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
      return `${mm}/${dd}（${weekDays[dt.getDay()]}）`;
    };

    const sorted = Array.from(dateSet).sort();
    const options = sorted.map((dStr) => ({
      key: dStr,
      label: formatDateLabel(dStr),
      isToday: dStr === todayStr,
    }));

    options.push({
      key: "all",
      label: "全部假日",
      isToday: false,
    });

    return options;
  }

  renderTimeFilterGroup() {
    const timeGroup = document.getElementById("time-filter-group");
    if (!timeGroup) return;

    timeGroup.innerHTML = this.dateOptions
      .map((opt) => {
        const isActive = this.state.timeScope === opt.key ? "active" : "";
        return `
          <button class="time-pill-btn ${isActive}" data-time="${opt.key}" id="time-pill-${opt.key}">
            <span>${opt.label}</span>
            <span class="pill-count" id="count-date-${opt.key}">0</span>
          </button>
        `;
      })
      .join("");
  }

  /* ==========================================================================
     Filtering Logic (Supports Composite Tags)
     ========================================================================== */
  getFilteredEvents() {
    return this.events.filter((item) => {
      const p = item.properties;
      const tags = p.tags || [];

      // 1. Time Scope Filter (Exact date matching or all)
      if (this.state.timeScope !== "all") {
        const targetDate = this.state.timeScope;
        const s = p.period?.start || "";
        const e = p.period?.end || "";
        if (s > targetDate || e < targetDate) {
          return false;
        }
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
    // 1. Update pill counts for each date option
    for (const opt of this.dateOptions) {
      const el = document.getElementById(`count-date-${opt.key}`);
      if (!el) continue;
      if (opt.key === "all") {
        el.textContent = this.events.length;
      } else {
        const cnt = this.events.filter((item) => {
          const s = item.properties.period?.start || "";
          const e = item.properties.period?.end || "";
          return s <= opt.key && e >= opt.key;
        }).length;
        el.textContent = cnt;
      }
    }

    // 2. Current Scope Events for category counts
    const currentScopeEvents = this.events.filter((item) => {
      if (this.state.timeScope === "all") return true;
      const s = item.properties.period?.start || "";
      const e = item.properties.period?.end || "";
      return s <= this.state.timeScope && e >= this.state.timeScope;
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

    if (this.state.timeScope === "all") {
      titleEl.textContent = "雙北全部假日活動";
    } else {
      const opt = this.dateOptions.find((o) => o.key === this.state.timeScope);
      titleEl.textContent = opt ? `${opt.label} 精選假日活動` : "精選假日活動";
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
    if (timeGroup) {
      timeGroup.addEventListener("click", (e) => {
        const btn = e.target.closest(".time-pill-btn");
        if (!btn) return;
        timeGroup.querySelectorAll(".time-pill-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.timeScope = btn.dataset.time;
        this.state.selectedId = null;
        this.render();
      });
    }

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
