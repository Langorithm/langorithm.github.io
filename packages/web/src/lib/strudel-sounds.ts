import type { SoundInfo } from "@flok-editor/lang-strudel";

// Sounds registered in the Strudel frame, for completing s("...") and
// bank("..."). The frame sets window.strudel to its own window, where
// evalScope has put Strudel's exports, soundMap included. Reading it on
// demand picks up sounds added later with samples(...) too.

const countOf = (data: any): number | undefined => {
  if (Array.isArray(data?.samples)) return data.samples.length;
  if (Array.isArray(data?.fonts)) return data.fonts.length;
  return undefined;
};

let lastMap: object | undefined;
let lastSounds: SoundInfo[] | null = null;

export const strudelSounds = (): SoundInfo[] | null => {
  const map = window.strudel?.soundMap?.get?.();
  if (!map) return null;
  // soundMap is a nanostores map: a new object on every change.
  if (map !== lastMap) {
    lastMap = map;
    lastSounds = Object.entries(map).map(([name, sound]: [string, any]) => ({
      name,
      type: sound?.data?.type ?? "sound",
      count: countOf(sound?.data),
    }));
  }
  return lastSounds;
};

// Readable machine names for banks, from the alias file the Strudel frame
// loads with aliasBank(): { "RolandTR909": "TR909", ... }. Keyed by the
// lower-case names Strudel registers, aliases included.

let bankNames: Record<string, string> | null = null;
let bankNamesRequested = false;

export const strudelBankNames = (): Record<string, string> | null => {
  if (!bankNamesRequested) {
    bankNamesRequested = true;
    fetch("/assets/tidal-drum-machines-alias.json")
      .then((res) => res.json())
      .then((aliases: Record<string, string | string[]>) => {
        const names: Record<string, string> = {};
        for (const [machine, alias] of Object.entries(aliases)) {
          names[machine.toLowerCase()] = machine;
          for (const a of [alias].flat()) names[a.toLowerCase()] = machine;
        }
        bankNames = names;
      })
      .catch(() => {});
  }
  return bankNames;
};
