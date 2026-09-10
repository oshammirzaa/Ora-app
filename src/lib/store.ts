import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type BotMsg, type BotStep, welcomeMessage } from "./bot";
import { PLANS, type LeadStatus, type Platform, type PlanId } from "./catalog";
import { uid } from "./utils";

export type Lead = {
  id: string;
  name: string;
  contact: string;
  platform: Platform;
  status: LeadStatus;
  notes: string;
  planId?: PlanId;
  createdAt: number;
};

export type Order = {
  id: string;
  customerName: string;
  contact: string;
  planId: PlanId;
  months: 1 | 12;
  amountUsd: number;
  amountPkr: number;
  status: "pending" | "active" | "expired";
  createdAt: number;
};

export type Settings = {
  businessName: string;
  whatsapp: string;
  currency: "USD" | "PKR";
};

export type BotThread = {
  id: string;
  messages: BotMsg[];
  step: BotStep;
  name?: string;
  contact?: string;
  planId?: PlanId;
  leadId?: string;
  createdAt: number;
  updatedAt: number;
};

type State = {
  settings: Settings;
  leads: Lead[];
  orders: Order[];
  botThreads: BotThread[];
  currentBotId: string | null;
  seenHeadlines: string[];
  setSettings: (patch: Partial<Settings>) => void;
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "status"> & { status?: LeadStatus }) => Lead;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  removeLead: (id: string) => void;
  addOrder: (
    order: Omit<Order, "id" | "createdAt" | "status" | "amountUsd" | "amountPkr"> & {
      status?: Order["status"];
    },
  ) => Order;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  ensureBotThread: () => string;
  pushBotMessage: (threadId: string, msg: Omit<BotMsg, "id" | "createdAt">) => void;
  patchBotThread: (id: string, patch: Partial<BotThread>) => void;
  newBotThread: () => string;
  markHeadlines: (ids: string[]) => void;
};

const T0 = 1_757_330_000_000;

const seedLeads: Lead[] = [
  {
    id: "lead_demo_1",
    name: "Ayesha K.",
    contact: "@ayesha.watches",
    platform: "instagram",
    status: "interested",
    notes: "Asked about kids profile. Family plan.",
    planId: "family",
    createdAt: T0 - 1000 * 60 * 60 * 18,
  },
  {
    id: "lead_demo_2",
    name: "Hamza",
    contact: "+92 300 0000000",
    platform: "whatsapp",
    status: "contacted",
    notes: "Wants cricket this weekend.",
    planId: "sports",
    createdAt: T0 - 1000 * 60 * 60 * 5,
  },
  {
    id: "lead_demo_3",
    name: "Website inquiry",
    contact: "sara@email.com",
    platform: "website",
    status: "new",
    notes: "Starter, 1 stick already at home.",
    planId: "starter",
    createdAt: T0 - 1000 * 60 * 40,
  },
];

function priceFor(planId: PlanId, months: 1 | 12) {
  const plan = PLANS.find((p) => p.id === planId)!;
  return months === 12
    ? { amountUsd: plan.usdYear, amountPkr: plan.pkrYear }
    : { amountUsd: plan.usdMonth, amountPkr: plan.pkrMonth };
}

function freshThread(): BotThread {
  const now = Date.now();
  const welcome = welcomeMessage();
  return {
    id: uid("bot"),
    step: "chat",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: uid("msg"),
        role: "bot",
        text: welcome.text,
        chips: welcome.chips,
        createdAt: now,
      },
    ],
  };
}

export const useEmber = create<State>()(
  persist(
    (set, get) => ({
      settings: {
        businessName: "Ember",
        whatsapp: "",
        currency: "PKR",
      },
      leads: seedLeads,
      orders: [
        {
          id: "ord_demo_1",
          customerName: "Bilal R.",
          contact: "+92 321 1111111",
          planId: "family",
          months: 12,
          amountUsd: 199,
          amountPkr: 54999,
          status: "active",
          createdAt: T0 - 1000 * 60 * 60 * 24 * 9,
        },
      ],
      botThreads: [],
      currentBotId: null,
      seenHeadlines: [],
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      addLead: (lead) => {
        const next: Lead = {
          ...lead,
          id: uid("lead"),
          status: lead.status ?? "new",
          createdAt: Date.now(),
        };
        set({ leads: [next, ...get().leads] });
        return next;
      },
      updateLead: (id, patch) =>
        set({ leads: get().leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
      removeLead: (id) => set({ leads: get().leads.filter((l) => l.id !== id) }),
      addOrder: (order) => {
        const priced = priceFor(order.planId, order.months);
        const next: Order = {
          ...order,
          ...priced,
          id: uid("ord"),
          status: order.status ?? "pending",
          createdAt: Date.now(),
        };
        set({ orders: [next, ...get().orders] });
        return next;
      },
      updateOrder: (id, patch) =>
        set({ orders: get().orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
      ensureBotThread: () => {
        const { currentBotId, botThreads } = get();
        const existing = botThreads.find((t) => t.id === currentBotId);
        if (existing) return existing.id;
        const t = freshThread();
        set({ botThreads: [t, ...botThreads], currentBotId: t.id });
        return t.id;
      },
      newBotThread: () => {
        const t = freshThread();
        set({ botThreads: [t, ...get().botThreads], currentBotId: t.id });
        return t.id;
      },
      pushBotMessage: (threadId, msg) => {
        const now = Date.now();
        set({
          botThreads: get().botThreads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  updatedAt: now,
                  messages: [...t.messages, { ...msg, id: uid("msg"), createdAt: now }],
                }
              : t,
          ),
        });
      },
      patchBotThread: (id, patch) =>
        set({
          botThreads: get().botThreads.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
          ),
        }),
      markHeadlines: (ids) => {
        const have = new Set(get().seenHeadlines);
        for (const id of ids) have.add(id);
        set({ seenHeadlines: [...have].slice(-200) });
      },
    }),
    {
      name: "ember-store",
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          botThreads: p.botThreads ?? [],
          currentBotId: p.currentBotId ?? null,
          seenHeadlines: p.seenHeadlines ?? [],
        };
      },
    },
  ),
);

export function EmberHydrate() {
  useEffect(() => {
    void useEmber.persist.rehydrate();
  }, []);
  return null;
}
