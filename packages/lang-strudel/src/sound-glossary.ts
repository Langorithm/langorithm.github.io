// What sound names mean, for people who don't already know drum-machine
// shorthand. Shown next to each sound in completions, and searchable: typing
// "kick" finds bd.
//
// Drum names are shared by every drum machine bank (RolandTR909_bd, ...) and
// the plain drum samples. The ones marked "workshop" are Strudel's own
// definitions (strudel.cc/workshop/first-sounds); the rest are the usual
// drum-machine terms. Meanings say what a sound is, not how it sounds.
// Edit freely.

export interface SoundMeaning {
  /** A few words, shown in the list: "bass drum (kick)" */
  meaning: string;
  /** Extra words to search by, beyond those in `meaning` */
  search?: string[];
}

/** Drum names, in the order they're listed when nothing is typed yet. */
export const drumGlossary: Record<string, SoundMeaning> = {
  bd: { meaning: "bass drum (kick)" }, // workshop
  sd: { meaning: "snare drum" }, // workshop
  hh: { meaning: "hihat (closed)", search: ["hat", "hi-hat"] }, // workshop
  oh: { meaning: "open hihat", search: ["hat", "hi-hat"] }, // workshop
  cp: { meaning: "clap", search: ["handclap"] },
  rim: { meaning: "rimshot", search: ["rim shot"] }, // workshop
  lt: { meaning: "low tom" }, // workshop
  mt: { meaning: "middle tom", search: ["mid"] }, // workshop
  ht: { meaning: "high tom" }, // workshop
  cr: { meaning: "crash cymbal" }, // workshop
  rd: { meaning: "ride cymbal" }, // workshop
  cb: { meaning: "cowbell" },
  sh: { meaning: "shaker" },
  tb: { meaning: "tambourine" },
  perc: { meaning: "percussion (various)" },
  misc: { meaning: "miscellaneous" },
  fx: { meaning: "effects" },
};

/** Built-in synths (generated, not recorded). */
export const synthGlossary: Record<string, SoundMeaning> = {
  sine: { meaning: "sine wave", search: ["wave"] },
  sin: { meaning: "sine wave (short for sine)", search: ["wave"] },
  triangle: { meaning: "triangle wave", search: ["wave"] },
  tri: { meaning: "triangle wave (short for triangle)", search: ["wave"] },
  square: { meaning: "square wave", search: ["wave"] },
  sqr: { meaning: "square wave (short for square)", search: ["wave"] },
  sawtooth: { meaning: "sawtooth wave", search: ["wave"] },
  saw: { meaning: "sawtooth wave (short for sawtooth)", search: ["wave"] },
  supersaw: { meaning: "several detuned sawtooth waves", search: ["wave"] },
  pulse: { meaning: "pulse wave, adjustable width", search: ["wave"] },
  user: { meaning: "custom waveform, set with .partials()" },
  one: { meaning: "constant signal, for modulation" },
  white: { meaning: "white noise: all frequencies equally" },
  pink: { meaning: "pink noise: less high frequencies than white" },
  brown: { meaning: "brown noise: mostly low frequencies" },
  crackle: { meaning: "crackle: sparse random clicks" },
  sbd: { meaning: "synthesized bass drum (kick)" },
  bytebeat: { meaning: "bytebeat: sound from a formula" },
  bus: { meaning: "audio input from a bus" },
  zzfx: { meaning: "ZzFX retro game-sound synth" },
};

/** Look up a sound's meaning by its name. */
export const meaningOf = (name: string): SoundMeaning | undefined =>
  drumGlossary[name] ?? synthGlossary[name];

/** Drum names in listing order, for ranking. */
export const drumOrder = Object.keys(drumGlossary);
