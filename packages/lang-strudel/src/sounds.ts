import { Completion } from "@codemirror/autocomplete";
import { drumOrder, meaningOf } from "./sound-glossary";

/** A sound registered in Strudel's sound map. */
export interface SoundInfo {
  /** Registered key, lower case: "bd", "gm_piano", "rolandtr909_bd" */
  name: string;
  /** "sample", "synth", "soundfont", ... as registered */
  type: string;
  /** Number of variants selectable with n() or "name:index", if known */
  count?: number;
}

/** A sound or bank, ready to be searched and listed. */
interface Entry {
  label: string;
  /** For writing: what it is, in a few words, or nothing */
  short: string;
  /** For learning: its detail panel */
  info?: string;
  /** Lower-case words to search by, besides the label */
  terms: string[];
  /** Position among the common drum names, or Infinity */
  drumRank: number;
  /** Sample reachable through a bank (rolandtr909_bd), ranked last in s() */
  inBank: boolean;
  type: string;
}

export interface SoundIndex {
  /** Sounds to offer in s(): all but drum machines' (those go via bank()). */
  sounds: Entry[];
  /** Bank names, as in .bank("tr909") */
  banks: Entry[];
  /** Sounds within each bank, without the bank prefix: "bd", "sd", ... */
  bankSounds: Map<string, Entry[]>;
}

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const soundEntry = (
  sound: SoundInfo,
  label: string,
  inBank: boolean,
): Entry => {
  const glossary = meaningOf(label);
  const rank = drumOrder.indexOf(label);
  const n = sound.count ?? 0;
  const info = [
    glossary ? `${label}: ${glossary.meaning}` : label,
    n > 1
      ? `${n} recordings. Pick one with ${label}:0 to ${label}:${n - 1} in the pattern, or with .n(): s("${label}").n(2)`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    label,
    short: glossary?.meaning ?? (sound.type === "sample" ? "" : sound.type),
    info,
    terms: glossary
      ? [
          ...wordsOf(glossary.meaning),
          ...(glossary.search ?? []).flatMap(wordsOf),
        ]
      : [],
    drumRank: rank < 0 ? Infinity : rank,
    inBank,
    type: "sound",
  };
};

/** "RolandTR909" → "Roland TR909" */
const spaced = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, "$1 $2");

/**
 * Index the sound map for s() and bank(). bank("x") just prepends "x_" to
 * sound names, so any sample named "<bank>_<sound>" is reachable through a
 * bank. Drum machines' samples are left out of s(); other underscored
 * samples are ordinary sounds too (vcsl's snare_modern), so s() lists them,
 * ranked below plain names. Soundfonts (gm_*) aren't samples, so they never
 * form banks.
 *
 * `bankNames` maps lower-case bank names, aliases included, to a readable
 * machine name: tr909 → "RolandTR909".
 */
export const indexSounds = (
  all: SoundInfo[],
  bankNames: Record<string, string> = {},
): SoundIndex => {
  const sounds: Entry[] = [];
  const bankSounds = new Map<string, Entry[]>();
  for (const sound of all) {
    const sep = sound.name.indexOf("_");
    const inBank = sound.type === "sample" && sep > 0;
    sounds.push(soundEntry(sound, sound.name, inBank));
    if (!inBank) continue;
    const bank = sound.name.slice(0, sep);
    let list = bankSounds.get(bank);
    if (!list) bankSounds.set(bank, (list = []));
    list.push(soundEntry(sound, sound.name.slice(sep + 1), false));
  }
  // Drum machines (rolandtr909_bd, ...) are only offered through bank(), so
  // their hundreds of entries stay out of s(). A drum machine is a bank with
  // a known machine name, or one holding nothing but drum names. Other
  // underscored samples (vcsl's snare_modern) are ordinary sounds.
  const machines = new Set(
    [...bankSounds]
      .filter(
        ([name, list]) =>
          bankNames[name] || list.every((e) => drumOrder.includes(e.label)),
      )
      .map(([name]) => name),
  );
  const plainSounds = sounds.filter(
    (e) => !(e.inBank && machines.has(e.label.slice(0, e.label.indexOf("_")))),
  );

  const banks = [...bankSounds].map(([name, list]): Entry => {
    const machine = bankNames[name] ? spaced(bankNames[name]) : "";
    return {
      label: name,
      short: machine,
      info: `${machine || name}: ${list.map((c) => c.label).join(" ")}`,
      terms: wordsOf(machine),
      drumRank: Infinity,
      inBank: false,
      type: "bank",
    };
  });
  return { sounds: plainSounds, banks, bankSounds };
};

/**
 * Rank entries for what's been typed: exact name, then a name prefix or a
 * word of the meaning ("kick" finds bd). Only prefixes count, so "s" never
 * finds bass. With
 * nothing typed, common drum names come first.
 */
export const searchEntries = (
  entries: Entry[],
  typed: string,
): Completion[] => {
  const q = typed.toLowerCase();
  const tierOf = (e: Entry): number => {
    if (!q) return 0;
    if (e.label === q) return 0;
    // A name prefix and a meaning word rank alike, so "sn" puts sd (snare
    // drum) with snare_modern, common drum names first.
    if (e.label.startsWith(q) || e.terms.some((t) => t.startsWith(q))) return 1;
    return -1;
  };
  return entries
    .map((e) => ({ e, tier: tierOf(e) }))
    .filter(({ tier }) => tier >= 0)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(a.e.inBank) - Number(b.e.inBank) ||
        a.e.drumRank - b.e.drumRank ||
        a.e.label.localeCompare(b.e.label),
    )
    .map(({ e }) => ({
      label: e.label,
      detail: e.short || undefined,
      info: e.info,
      type: e.type,
    }));
};

/** Memoize indexSounds on the identity of its inputs. */
export const soundIndexer = (
  getSounds: () => SoundInfo[] | null,
  getBankNames: () => Record<string, string> | null,
) => {
  let lastSounds: SoundInfo[] | null = null;
  let lastNames: Record<string, string> | null = null;
  let index: SoundIndex | null = null;
  return (): SoundIndex | null => {
    const all = getSounds();
    if (!all) return null;
    const names = getBankNames();
    if (all !== lastSounds || names !== lastNames) {
      lastSounds = all;
      lastNames = names;
      index = indexSounds(all, names ?? {});
    }
    return index;
  };
};
