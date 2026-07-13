import type {
  GamePlatformFamily,
  MediaItem,
  MediaStatus,
  MediaType,
  VideoSubtype,
} from "./sample-data";

export type { GamePlatformFamily, MediaItem, MediaStatus, MediaType, VideoSubtype };

export type NoteKind = "review" | "excerpt" | "thought";
export type ExperienceStatus = Exclude<MediaStatus, "planned">;

export type ContentExperience = {
  id: string;
  contentId: string;
  status: ExperienceStatus;
  startedAt: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentNote = {
  id: string;
  contentId: string;
  experienceId?: string;
  kind: NoteKind;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};
