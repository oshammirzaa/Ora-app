import type { SearchNet } from "./catalog";
import type { InterestBand } from "./interest";
import type { PlanId } from "./catalog";

export const HUNTS = [
  {
    id: "sports",
    label: "Sports on Fire Stick",
    query: "watch live cricket football on firestick",
    why: "Match-day buyers.",
  },
  {
    id: "setup",
    label: "Need live TV setup",
    query: "how to watch live tv on fire tv stick",
    why: "They have the stick. They need a service.",
  },
  {
    id: "idle",
    label: "Stick in a drawer",
    query: "fire tv stick not using it",
    why: "Hardware sitting unused.",
  },
  {
    id: "cable",
    label: "Cutting cable",
    query: "switching from cable to firestick",
    why: "Shopping for a living-room app.",
  },
  {
    id: "family",
    label: "Family TV",
    query: "best family streaming fire tv stick",
    why: "Parents wanting one app.",
  },
  {
    id: "ask",
    label: "Looking for a subscription",
    query: "looking for live tv subscription firestick",
    why: "Direct ask.",
  },
] as const;

export const HUNT_NETS: { id: SearchNet; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google" },
  { id: "x", label: "X" },
  { id: "reddit", label: "Reddit" },
  { id: "youtube", label: "YouTube" },
];

export type HuntHit = {
  id: string;
  title: string;
  body: string;
  href: string;
  author: string;
  source: string;
  at?: string;
  score: number;
  band: InterestBand;
  planId: PlanId;
  reply: string;
  summary: string;
};
