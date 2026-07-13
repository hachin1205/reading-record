export type MediaType = "book" | "video" | "game" | "writing";
export type MediaStatus = "planned" | "in_progress" | "finished" | "dropped";
export type VideoSubtype = "movie" | "anime" | "j_drama" | "us_tv" | "documentary";
export type GamePlatformFamily = "playstation" | "nintendo" | "xbox" | "pc";

export type MediaItem = {
  id: string;
  type: MediaType;
  subtype?: VideoSubtype | "visual_novel" | "essay" | "short_story";
  title: string;
  creator: string;
  creatorGroup?: string;
  creatorSortLabel?: string;
  status: MediaStatus;
  rating?: number;
  finishedAt?: string;
  publishedAt?: string;
  updatedAt: string;
  pageCount?: number;
  progressPercent?: number;
  completionCount?: number;
  favorite?: boolean;
  featured?: boolean;
  coverUrl?: string;
  isbn?: string;
  publisher?: string;
  sourceUrl?: string;
  sourceName?: string;
  coverTone: [string, string];
  platformFamily?: GamePlatformFamily;
  note?: string;
  themeYoutubeId?: string;
  themeStartSeconds?: number;
  themeEndSeconds?: number;
  themeTitle?: string;
};

const now = new Date("2026-05-28T12:00:00-04:00");
const monthsAgo = (months: number) => {
  const date = new Date(now);
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
};

const tones: Array<[string, string]> = [
  ["#8d3f32", "#d6a06f"],
  ["#284d5f", "#8cb4b2"],
  ["#56653b", "#d4c37c"],
  ["#2e2f36", "#8b8d84"],
  ["#7a5438", "#d8bb87"],
  ["#25505d", "#d0e0cf"],
  ["#5b3f65", "#c9a7bf"],
  ["#743939", "#d9c7a1"],
];

export const mediaItems: MediaItem[] = [
  {
    id: "book-norwegian-wood",
    type: "book",
    title: "Norwegian Wood",
    creator: "Haruki Murakami",
    creatorGroup: "Murakami",
    creatorSortLabel: "M",
    status: "in_progress",
    rating: 4.5,
    pageCount: 296,
    progressPercent: 64,
    completionCount: 2,
    featured: true,
    favorite: true,
    updatedAt: monthsAgo(0),
    coverTone: tones[0],
    note: "Returning to it feels different this time.",
  },
  {
    id: "book-kokoro",
    type: "book",
    title: "Kokoro",
    creator: "夏目漱石",
    creatorGroup: "夏目漱石",
    creatorSortLabel: "な",
    status: "finished",
    rating: 5,
    pageCount: 352,
    progressPercent: 100,
    completionCount: 1,
    favorite: true,
    finishedAt: monthsAgo(16),
    updatedAt: monthsAgo(5),
    coverTone: tones[1],
  },
  {
    id: "book-dune",
    type: "book",
    title: "Dune",
    creator: "Frank Herbert",
    creatorGroup: "Herbert",
    creatorSortLabel: "H",
    status: "finished",
    rating: 4,
    pageCount: 688,
    progressPercent: 100,
    completionCount: 1,
    finishedAt: monthsAgo(2),
    updatedAt: monthsAgo(2),
    coverTone: tones[2],
  },
  {
    id: "book-left-hand",
    type: "book",
    title: "The Left Hand",
    creator: "Ursula K. Le Guin",
    creatorGroup: "Le Guin",
    creatorSortLabel: "L",
    status: "finished",
    rating: 4.5,
    pageCount: 304,
    progressPercent: 100,
    finishedAt: monthsAgo(4),
    updatedAt: monthsAgo(4),
    coverTone: tones[3],
  },
  {
    id: "book-long-goodbye",
    type: "book",
    title: "Long Goodbye",
    creator: "Raymond Chandler",
    creatorGroup: "Chandler",
    creatorSortLabel: "C",
    status: "finished",
    rating: 4,
    pageCount: 180,
    progressPercent: 100,
    finishedAt: monthsAgo(8),
    updatedAt: monthsAgo(8),
    coverTone: tones[4],
  },
  {
    id: "video-gundam-zz",
    type: "video",
    subtype: "anime",
    title: "Mobile Suit Gundam ZZ",
    creator: "Sunrise",
    status: "finished",
    rating: 4,
    finishedAt: monthsAgo(3),
    updatedAt: monthsAgo(3),
    coverTone: tones[0],
    themeYoutubeId: "_qy0lyl5SDI",
    themeStartSeconds: 0,
    themeEndSeconds: 35,
    themeTitle: "Silent Voice",
  },
  {
    id: "video-arrival",
    type: "video",
    subtype: "movie",
    title: "Arrival",
    creator: "Denis Villeneuve",
    status: "finished",
    rating: 4.5,
    completionCount: 3,
    favorite: true,
    finishedAt: monthsAgo(19),
    updatedAt: monthsAgo(3),
    coverTone: tones[5],
  },
  {
    id: "video-her",
    type: "video",
    subtype: "movie",
    title: "Her",
    creator: "Spike Jonze",
    status: "finished",
    rating: 4,
    finishedAt: monthsAgo(1),
    updatedAt: monthsAgo(1),
    coverTone: tones[6],
  },
  {
    id: "video-anime",
    type: "video",
    subtype: "anime",
    title: "Frieren",
    creator: "Madhouse",
    status: "in_progress",
    rating: 4.5,
    updatedAt: monthsAgo(0),
    coverTone: tones[7],
  },
  {
    id: "video-eva",
    type: "video",
    subtype: "anime",
    title: "Evangelion",
    creator: "Gainax",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(2),
    updatedAt: monthsAgo(2),
    coverTone: tones[1],
    themeYoutubeId: "_qy0lyl5SDI",
    themeStartSeconds: 8,
    themeEndSeconds: 38,
    themeTitle: "Opening Theme",
  },
  {
    id: "video-blade-runner",
    type: "video",
    subtype: "movie",
    title: "Blade Runner",
    creator: "Ridley Scott",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(4),
    updatedAt: monthsAgo(4),
    coverTone: tones[2],
  },
  {
    id: "video-long-vacation",
    type: "video",
    subtype: "j_drama",
    title: "Long Vacation",
    creator: "Fuji TV",
    status: "finished",
    rating: 4,
    finishedAt: monthsAgo(5),
    updatedAt: monthsAgo(5),
    coverTone: tones[3],
  },
  {
    id: "video-twin-peaks",
    type: "video",
    subtype: "us_tv",
    title: "Twin Peaks",
    creator: "David Lynch",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(6),
    updatedAt: monthsAgo(6),
    coverTone: tones[4],
  },
  {
    id: "video-patlabor",
    type: "video",
    subtype: "anime",
    title: "Patlabor",
    creator: "Headgear",
    status: "finished",
    rating: 4,
    finishedAt: monthsAgo(7),
    updatedAt: monthsAgo(7),
    coverTone: tones[5],
    themeYoutubeId: "_qy0lyl5SDI",
    themeStartSeconds: 0,
    themeEndSeconds: 25,
    themeTitle: "Theme Demo",
  },
  {
    id: "game-outer-wilds",
    type: "game",
    title: "Outer Wilds",
    creator: "Mobius Digital",
    status: "finished",
    rating: 5,
    completionCount: 1,
    favorite: true,
    finishedAt: monthsAgo(13),
    updatedAt: monthsAgo(2),
    coverTone: tones[1],
    platformFamily: "playstation",
  },
  {
    id: "game-zelda",
    type: "game",
    title: "Zelda",
    creator: "Nintendo",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(2),
    updatedAt: monthsAgo(2),
    coverTone: tones[2],
    platformFamily: "nintendo",
  },
  {
    id: "game-disco",
    type: "game",
    title: "Disco Elysium",
    creator: "ZA/UM",
    status: "dropped",
    rating: 4,
    finishedAt: monthsAgo(1),
    updatedAt: monthsAgo(1),
    coverTone: tones[3],
    platformFamily: "pc",
  },
  {
    id: "game-umineko",
    type: "game",
    subtype: "visual_novel",
    title: "Umineko",
    creator: "07th Expansion",
    status: "finished",
    rating: 5,
    finishedAt: monthsAgo(3),
    updatedAt: monthsAgo(3),
    coverTone: tones[6],
    platformFamily: "pc",
  },
  {
    id: "game-persona",
    type: "game",
    title: "Persona",
    creator: "Atlus",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(4),
    updatedAt: monthsAgo(4),
    coverTone: tones[7],
    platformFamily: "playstation",
  },
  {
    id: "game-mario",
    type: "game",
    title: "Wonder",
    creator: "Nintendo",
    status: "in_progress",
    updatedAt: monthsAgo(1),
    coverTone: tones[0],
    platformFamily: "nintendo",
  },
  {
    id: "game-steins-gate",
    type: "game",
    subtype: "visual_novel",
    title: "Steins;Gate",
    creator: "5pb.",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(1),
    updatedAt: monthsAgo(1),
    coverTone: tones[1],
    platformFamily: "playstation",
  },
  {
    id: "game-13-sentinels",
    type: "game",
    title: "13 Sentinels",
    creator: "Vanillaware",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(2),
    updatedAt: monthsAgo(2),
    coverTone: tones[2],
    platformFamily: "playstation",
  },
  {
    id: "game-higurashi",
    type: "game",
    subtype: "visual_novel",
    title: "Higurashi",
    creator: "07th Expansion",
    status: "finished",
    rating: 4,
    finishedAt: monthsAgo(3),
    updatedAt: monthsAgo(3),
    coverTone: tones[3],
    platformFamily: "pc",
  },
  {
    id: "game-xenoblade",
    type: "game",
    title: "Xenoblade",
    creator: "Monolith Soft",
    status: "finished",
    rating: 4,
    finishedAt: monthsAgo(4),
    updatedAt: monthsAgo(4),
    coverTone: tones[4],
    platformFamily: "nintendo",
  },
  {
    id: "game-ff7",
    type: "game",
    title: "FFVII",
    creator: "Square Enix",
    status: "finished",
    rating: 4.5,
    finishedAt: monthsAgo(5),
    updatedAt: monthsAgo(5),
    coverTone: tones[5],
    platformFamily: "playstation",
  },
  {
    id: "writing-night-notes",
    type: "writing",
    subtype: "essay",
    title: "Notes After Midnight",
    creator: "Huaqing",
    status: "finished",
    favorite: true,
    publishedAt: monthsAgo(20),
    updatedAt: monthsAgo(1),
    coverTone: tones[4],
  },
  {
    id: "writing-short",
    type: "writing",
    subtype: "short_story",
    title: "A Small Room",
    creator: "Huaqing",
    status: "finished",
    publishedAt: monthsAgo(3),
    updatedAt: monthsAgo(3),
    coverTone: tones[5],
  },
];

for (let index = 0; index < 42; index += 1) {
  const authorIndex = index % 8;
  const pageCount = [128, 214, 336, 482, 640, 912][index % 6];
  mediaItems.push({
    id: `book-dummy-${index}`,
    type: "book",
    title: `Volume ${index + 1}`,
    creator: ["村上春樹", "夏目漱石", "Le Guin", "Chandler", "Atwood", "太宰治", "Asimov", "Borges"][authorIndex],
    creatorGroup: ["村上春樹", "夏目漱石", "Le Guin", "Chandler", "Atwood", "太宰治", "Asimov", "Borges"][authorIndex],
    creatorSortLabel: ["ま", "な", "L", "C", "A", "た", "A", "B"][authorIndex],
    status: index % 17 === 0 ? "in_progress" : index % 19 === 0 ? "dropped" : "finished",
    rating: 3 + (index % 5) * 0.5,
    pageCount,
    progressPercent: index % 17 === 0 ? 35 + (index % 4) * 12 : index % 19 === 0 ? 22 : 100,
    completionCount: index % 11 === 0 ? 2 : 1,
    favorite: index % 13 === 0,
    featured: index % 29 === 0,
    finishedAt: monthsAgo(index % 24),
    updatedAt: monthsAgo(index % 12),
    coverTone: tones[index % tones.length],
  });
}

export const activeYear = 2026;

export function belongsOnHome(item: MediaItem) {
  const date = item.finishedAt ?? item.publishedAt;
  const inActiveYear = date ? new Date(date).getFullYear() === activeYear : false;
  return item.status === "in_progress" || item.featured || item.favorite || inActiveYear;
}

export function belongsInActiveYear(item: MediaItem) {
  const date = item.finishedAt ?? item.publishedAt;
  const inActiveYear = date ? new Date(date).getFullYear() === activeYear : false;
  return item.status === "in_progress" || item.featured || inActiveYear;
}

export function isCurrent(item: MediaItem) {
  return item.status === "in_progress" || item.featured === true;
}

export function typeLabel(type: MediaType) {
  if (type === "book") return "Books";
  if (type === "video") return "Films";
  if (type === "game") return "Games";
  return "Writings";
}

export function statusCounts(items: MediaItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    },
    { total: 0, planned: 0, in_progress: 0, finished: 0, dropped: 0 },
  );
}
