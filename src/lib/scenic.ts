/**
 * Scenic photos for Home while the family library is switched off — the
 * country around Colorado City: the Arizona Strip, Zion, Kanab, the Grand
 * Canyon. All from Wikimedia Commons under free licenses; each carries the
 * credit the license asks for. One per day, in a fixed order, so the whole
 * family sees the same picture.
 */
export interface Scenic {
  title: string; place: string;
  /** 1600 px thumb — the fallback when the browser ignores srcSet. */
  src: string;
  /** 640 / 1024 / 1600 / 1920 px thumbs; every source is at least 2000 px wide (Commons imageinfo, 2026-09-09), so none of these asks for an upscale. */
  srcSet: string;
  credit: string; license: string; source: string;
}

const THUMB_WIDTHS = [640, 1024, 1600, 1920] as const;
const thumb = (path: string, w: number) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${w}px-${path.split("/").pop()}`;
const commons = (path: string) => thumb(path, 1600);
const srcSet = (path: string) => THUMB_WIDTHS.map((w) => `${thumb(path, w)} ${w}w`).join(", ");
/** Hero width by viewport: full width on phones, the content column on larger screens. */
export const SCENIC_SIZES = "(max-width: 900px) 100vw, min(100vw - 280px, 1200px)";
const page = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;

export const SCENIC: Scenic[] = [
  { title: "Vermilion Cliffs", place: "Arizona Strip", src: commons("9/9b/Vermilion_Cliffs_600.jpg"), srcSet: srcSet("9/9b/Vermilion_Cliffs_600.jpg"), credit: "Gillfoto", license: "CC BY-SA 4.0", source: page("Vermilion_Cliffs_600.jpg") },
  { title: "The Watchman", place: "Zion National Park", src: commons("6/6e/The_Watchman%2C_Zion_National_Park%2C_Oct_16.jpg"), srcSet: srcSet("6/6e/The_Watchman%2C_Zion_National_Park%2C_Oct_16.jpg"), credit: "An Errant Knight", license: "CC BY-SA 4.0", source: page("The_Watchman,_Zion_National_Park,_Oct_16.jpg") },
  { title: "Coral Pink Sand Dunes", place: "near Kanab", src: commons("d/d7/Coral_Pink_Sand_Dunes_State_Park%2C_Utah%2C_USA9.jpg"), srcSet: srcSet("d/d7/Coral_Pink_Sand_Dunes_State_Park%2C_Utah%2C_USA9.jpg"), credit: "dconvertini", license: "CC BY-SA 2.0", source: page("Coral_Pink_Sand_Dunes_State_Park,_Utah,_USA9.jpg") },
  { title: "Grand Canyon at sunset", place: "South Rim", src: commons("1/12/Grand_Canyon_South_Rim_at_Sunset.jpg"), srcSet: srcSet("1/12/Grand_Canyon_South_Rim_at_Sunset.jpg"), credit: "Mgimelfarb", license: "CC0", source: page("Grand_Canyon_South_Rim_at_Sunset.jpg") },
  { title: "Bryce Point", place: "Bryce Canyon", src: commons("f/f8/Bryce_Point_Bryce_Canyon_November_2018_001.jpg"), srcSet: srcSet("f/f8/Bryce_Point_Bryce_Canyon_November_2018_001.jpg"), credit: "King of Hearts", license: "CC BY-SA 4.0", source: page("Bryce_Point_Bryce_Canyon_November_2018_001.jpg") },
  { title: "Lake Powell", place: "Wahweap Overlook, Page", src: commons("1/11/Lake_Powell_from_Wahweap_Overlook%2C_Page%2C_Arizona_-_April_2026.jpg"), srcSet: srcSet("1/11/Lake_Powell_from_Wahweap_Overlook%2C_Page%2C_Arizona_-_April_2026.jpg"), credit: "Espandero", license: "CC BY-SA 4.0", source: page("Lake_Powell_from_Wahweap_Overlook,_Page,_Arizona_-_April_2026.jpg") },
  { title: "Condors at Vermilion Cliffs", place: "Arizona Strip", src: commons("a/a4/Condors_stand_on_a_rock_at_Vermilion_Cliffs_%2826606395162%29.jpg"), srcSet: srcSet("a/a4/Condors_stand_on_a_rock_at_Vermilion_Cliffs_%2826606395162%29.jpg"), credit: "Bureau of Land Management", license: "Public domain", source: page("Condors_stand_on_a_rock_at_Vermilion_Cliffs_(26606395162).jpg") },
  { title: "Monument Valley", place: "Forrest Gump Point", src: commons("6/60/Forrest_Gump_Point_Monument_Valley_November_2018_001.jpg"), srcSet: srcSet("6/60/Forrest_Gump_Point_Monument_Valley_November_2018_001.jpg"), credit: "King of Hearts", license: "CC BY-SA 4.0", source: page("Forrest_Gump_Point_Monument_Valley_November_2018_001.jpg") },
  { title: "Snow Canyon", place: "near St. George", src: commons("0/01/Snow_Canyon_Utah_March_2019.jpg"), srcSet: srcSet("0/01/Snow_Canyon_Utah_March_2019.jpg"), credit: "Wilson44691", license: "CC0", source: page("Snow_Canyon_Utah_March_2019.jpg") },
  { title: "Lower Antelope Canyon", place: "Page", src: commons("e/ec/Lower_Antelope_Canyon_November_2018_008.jpg"), srcSet: srcSet("e/ec/Lower_Antelope_Canyon_November_2018_008.jpg"), credit: "King of Hearts", license: "CC BY-SA 4.0", source: page("Lower_Antelope_Canyon_November_2018_008.jpg") },
  { title: "Hopi Point after rain", place: "Grand Canyon", src: commons("7/7b/Grand_Canyon_Hopi_Point_with_rainbow_2013.jpg"), srcSet: srcSet("7/7b/Grand_Canyon_Hopi_Point_with_rainbow_2013.jpg"), credit: "Tuxyso", license: "CC BY-SA 3.0", source: page("Grand_Canyon_Hopi_Point_with_rainbow_2013.jpg") },
];

/** Same picture for everyone on a given day; walks the list in order. */
export function scenicForDay(dateISO: string): Scenic {
  const days = Math.floor(Date.parse(dateISO + "T00:00:00Z") / 86400000);
  return SCENIC[((days % SCENIC.length) + SCENIC.length) % SCENIC.length];
}
