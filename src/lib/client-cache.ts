import { getMe, getPublicSettings, type Advisor, type Me, type SiteSettings } from "@/lib/ora";

let settingsAt = 0;
let settingsVal: SiteSettings | null = null;
let meAt = 0;
let meVal: Me | null = null;
let advisorsVal: Advisor[] | null = null;

export function cachedPublicSettings() {
  if (settingsVal && Date.now() - settingsAt < 60_000) return Promise.resolve(settingsVal);
  return getPublicSettings().then((s) => {
    settingsVal = s;
    settingsAt = Date.now();
    return s;
  });
}

export function cachedMe() {
  if (meVal && Date.now() - meAt < 4_000) return Promise.resolve(meVal);
  return getMe().then((m) => {
    meVal = m;
    meAt = Date.now();
    return m;
  });
}

export function rememberMe(m: Me) {
  meVal = m;
  meAt = Date.now();
}

export function forgetMe() {
  meVal = null;
  meAt = 0;
}

export function rememberAdvisors(list: Advisor[]) {
  advisorsVal = list;
}

export function peekAdvisors() {
  return advisorsVal;
}
