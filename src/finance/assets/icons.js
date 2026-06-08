/* Zitting HQ — icon set
 * Lucide-style line icons: 24×24, fill none, currentColor, ~1.75 stroke, round caps.
 * Stored as inner SVG markup; the <Icon> component wraps them in a sized <svg>.
 * Self-contained (no CDN) so it works offline and never races React.
 *
 * Substitution note: no proprietary icon font was provided. These match Lucide's
 * stroke weight / line style; swap in real Lucide if/when available.
 */
window.ZT_ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.6"/><path d="M3 9.5h13.5a1.8 1.8 0 0 1 1.8 1.8v2a1.8 1.8 0 0 1-1.8 1.8H3"/><circle cx="16.3" cy="12.5" r="1.05"/>',
  transfers: '<path d="M7 7h12"/><path d="M16 4l3 3-3 3"/><path d="M17 17H5"/><path d="M8 20l-3-3 3-3"/>',
  list: '<path d="M8.5 6.5h11.5"/><path d="M8.5 12h11.5"/><path d="M8.5 17.5h11.5"/><circle cx="4.3" cy="6.5" r="1.05"/><circle cx="4.3" cy="12" r="1.05"/><circle cx="4.3" cy="17.5" r="1.05"/>',
  pie: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  trendingUp: '<path d="M3 17l6-6 4 4 7-7"/><path d="M17 7h4v4"/>',
  repeat: '<path d="M17 2.5l3 3-3 3"/><path d="M20 5.5H8.5a4.5 4.5 0 0 0-4.5 4.5v1"/><path d="M7 21.5l-3-3 3-3"/><path d="M4 18.5h11.5a4.5 4.5 0 0 0 4.5-4.5v-1"/>',
  allocations: '<circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.4 10.8 15.6 7.2"/><path d="M8.4 13.2 15.6 16.8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  receipt: '<path d="M6 2.5v19l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4v-19l-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6"/><path d="M9 12h4"/>',
  sparkles: '<path d="M12 3.5l1.5 4.4 4.4 1.6-4.4 1.5L12 15.5l-1.5-4.5L6 9.5l4.5-1.6z"/><path d="M19 4v3"/><path d="M5.5 16.5v3"/><path d="M4 18h3"/>',
  settings: '<line x1="3.5" y1="8" x2="20.5" y2="8"/><circle cx="9" cy="8" r="2.6"/><line x1="3.5" y1="16" x2="20.5" y2="16"/><circle cx="15" cy="16" r="2.6"/>',
  bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 4.6 2 5.8 2 5.8H4s2-1.2 2-5.8z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5.5v13"/><path d="M5.5 12h13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chevronRight: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  chevronDown: '<path d="M5.5 9l6.5 6.5L18.5 9"/>',
  chevronLeft: '<path d="M15 5.5L8.5 12l6.5 6.5"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  arrowDownRight: '<path d="M7 7l10 10"/><path d="M17 8v9H8"/>',
  arrowRight: '<path d="M4.5 12h15"/><path d="M13 5.5l6.5 6.5L13 18.5"/>',
  creditCard: '<rect x="3" y="5" width="18" height="14" rx="2.6"/><path d="M3 10h18"/><path d="M7 15h3.5"/>',
  bank: '<path d="M3 21h18"/><path d="M5 21V10"/><path d="M19 21V10"/><path d="M9.5 21V10M14.5 21V10"/><path d="M12 3 21 8.5H3z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.8-5.2 6-5.2s6 1.8 6 5.2"/><path d="M16 5.2a3.1 3.1 0 0 1 0 5.6"/><path d="M17.5 15c2.2.5 3.9 1.9 3.9 4.6"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  filter: '<path d="M3.5 5.5h17l-6.7 7.8v5.2l-3.6-1.9v-3.3z"/>',
  moreHorizontal: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  alert: '<path d="M12 3.2 22 20.5H2z"/><path d="M12 10v4.5"/><path d="M12 17.8h.01"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.6"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>',
  camera: '<path d="M3 9A2.6 2.6 0 0 1 5.6 6.4h1.2l1.3-2.1h7.8l1.3 2.1h1.2A2.6 2.6 0 0 1 22 9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12.5" cy="13" r="3.6"/>',
  flag: '<path d="M5 21.5V3.5"/><path d="M5 4h12l-2.2 4 2.2 4H5"/>',
  logout: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 12h9"/><path d="M16 9l3 3-3 3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.1"/>',
  pencil: '<path d="M4 20h4L19.5 8.5l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  dollar: '<path d="M12 2.5v19"/><path d="M16 7C16 5.2 14.2 4 12 4S8 5.2 8 7s1.8 3 4 3 4 1.2 4 3-1.8 3-4 3-4-1.2-4-3"/>',
  piggyBank: '<path d="M19 9.5c1 .4 1.6 1.3 1.6 2.4 0 1-.6 1.9-1.5 2.3L19 17h-2.5l-.6-1.4a7 7 0 0 1-4.8 0L10.5 17H8l-.4-2A5.3 5.3 0 0 1 5 10.5C5 7 8.4 4.5 12.5 4.5c2 0 3.8.6 5.1 1.6L20 5.5l-1 4z"/><circle cx="9.5" cy="9.5" r=".9"/>',
  arrowDown: '<path d="M12 4.5v15"/><path d="M6 13l6 6 6-6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  link: '<path d="M9.5 14.5l5-5"/><path d="M8 12 6 14a3.5 3.5 0 0 0 5 5l2-2"/><path d="M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.7 4.7l1.85 1.85M17.45 17.45l1.85 1.85M2.5 12h2.6M18.9 12h2.6M4.7 19.3l1.85-1.85M17.45 6.55l1.85-1.85"/>',
  moon: '<path d="M20.5 14.8A8.2 8.2 0 0 1 9.2 3.5 7.2 7.2 0 1 0 20.5 14.8z"/>',
};
