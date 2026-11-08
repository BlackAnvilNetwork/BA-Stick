/**
 * One-shot combat SFX. Pools swing wooshes so haste can overlap; TD plays once per wave.
 */
import { JOB_WEAPON, isJobId, type JobId, type JobWeapon } from "@bellgrave/combat";

const SFX_URL = {
  staff: "/audio/staff-woosh.mp3",
  sword: "/audio/sword-woosh.mp3",
  temporal_distortion: "/audio/time-distortion.mp3",
} as const;

type SfxKind = keyof typeof SFX_URL;

const POOL = 4;
const pools = new Map<SfxKind, HTMLAudioElement[]>();
const cursors = new Map<SfxKind, number>();
let unlocked = false;
/** Dedupes AoE TD so six hits don't fire six sounds. */
let lastTdWaveUntil = 0;
let chimeCtx: AudioContext | null = null;

function ensurePool(kind: SfxKind): HTMLAudioElement[] {
  let pool = pools.get(kind);
  if (!pool) {
    const n = kind === "temporal_distortion" ? 2 : POOL;
    pool = Array.from({ length: n }, () => {
      const a = new Audio(SFX_URL[kind]);
      a.preload = "auto";
      a.volume = 0.55;
      return a;
    });
    pools.set(kind, pool);
    cursors.set(kind, 0);
  }
  return pool;
}

/** Call from a user gesture path (shares unlock with BGM). */
export function unlockCombatSfx(): void {
  unlocked = true;
  for (const kind of Object.keys(SFX_URL) as SfxKind[]) {
    for (const a of ensurePool(kind)) {
      a.load();
    }
  }
  if (chimeCtx) void chimeCtx.resume();
}

function playKind(kind: SfxKind, volume = 0.55): void {
  if (!unlocked) return;
  const pool = ensurePool(kind);
  const i = cursors.get(kind) ?? 0;
  cursors.set(kind, (i + 1) % pool.length);
  const a = pool[i]!;
  try {
    a.pause();
    a.currentTime = 0;
    a.volume = Math.max(0, Math.min(1, volume));
    void a.play().catch(() => {
      /* autoplay / missing file */
    });
  } catch {
    /* ignore */
  }
}

export function weaponForJob(job: JobId | string | undefined | null): JobWeapon {
  if (job && isJobId(job)) return JOB_WEAPON[job];
  return "staff";
}

export function sfxForWeaponFamily(family: string | undefined | null): JobWeapon | null {
  if (family === "staff" || family === "club") return "staff";
  if (
    family === "sword" ||
    family === "greatsword" ||
    family === "dagger" ||
    family === "axe" ||
    family === "knuckles"
  ) {
    return "sword";
  }
  return null;
}

/** Player / ally melee swing. */
export function playJobSwing(
  job: JobId | string | undefined | null,
  volume?: number,
  weaponFamily?: string | null,
): void {
  playKind(sfxForWeaponFamily(weaponFamily) ?? weaponForJob(job), volume);
}

/** Enemy sword swing (Petrified Guards, future blade mobs). */
export function playEnemySwing(volume?: number): void {
  playKind("sword", volume ?? 0.5);
}

/**
 * Temporal Distortion impact — once per cast wave (shared animUntil across hits).
 */
export function playTemporalDistortion(impactUntil: number, volume = 0.72): void {
  if (impactUntil <= lastTdWaveUntil) return;
  lastTdWaveUntil = impactUntil;
  playKind("temporal_distortion", volume);
}

/** Web Audio chimes — no extra mp3s. */
function playQuestChime(notes: ReadonlyArray<{ freq: number; at: number; dur: number; gain: number }>): void {
  if (!unlocked || typeof AudioContext === "undefined") return;
  try {
    if (!chimeCtx) chimeCtx = new AudioContext();
    void chimeCtx.resume();
    const now = chimeCtx.currentTime;
    for (const n of notes) {
      const osc = chimeCtx.createOscillator();
      const g = chimeCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      const t0 = now + n.at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(n.gain, t0 + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(g);
      g.connect(chimeCtx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
  } catch {
    /* ignore */
  }
}

/** Short rising chime when a quest is accepted. */
export function playQuestAccept(): void {
  playQuestChime([
    { freq: 523.25, at: 0, dur: 0.22, gain: 0.09 },
    { freq: 659.25, at: 0.11, dur: 0.28, gain: 0.11 },
  ]);
}

/** Fanfare when a quest is turned in. */
export function playQuestComplete(): void {
  playQuestChime([
    { freq: 523.25, at: 0, dur: 0.18, gain: 0.08 },
    { freq: 659.25, at: 0.1, dur: 0.18, gain: 0.09 },
    { freq: 783.99, at: 0.2, dur: 0.2, gain: 0.1 },
    { freq: 1046.5, at: 0.32, dur: 0.42, gain: 0.12 },
  ]);
}
