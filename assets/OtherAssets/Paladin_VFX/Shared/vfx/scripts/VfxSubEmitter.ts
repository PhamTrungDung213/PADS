/**
 * Unity Sub Emitters for Cocos ParticleSystem (Cocos 3.8 has none).
 * Written by cocos-vfx-importer-plus; template in extensions/cocos-vfx-importer-plus/runtime.
 *
 * Like Unity, every entry's emitter is ONE shared system: it never emits on its own, this
 * component emits into it whenever a particle of the system on this node is born (Birth: the
 * instance follows the particle, emitting by distance / rate until it dies) or dies (Death: an
 * instance at the death position). Each instance replays the entry system's own bursts, start
 * delay and rate over its duration. The shared systems simulate in world space, so moving their
 * node to the instance position before emit() places particles correctly.
 * No nodes are created or toggled at runtime (cheap, and no scheduler churn).
 */
import { _decorator, Color, Component, Mat4, ParticleSystem, Vec3 } from 'cc';

const { ccclass, property, executeInEditMode, executionOrder, menu } = _decorator;

export enum VfxSubEmitterType {
    Birth = 0,
    Collision = 1,
    Death = 2,
}

@ccclass('VfxSubEmitterEntry')
export class VfxSubEmitterEntry {
    @property({ type: ParticleSystem })
    emitter: ParticleSystem | null = null;

    /** Unity ParticleSystemSubEmitterType: 0 Birth, 1 Collision, 2 Death. */
    @property
    type = 2;

    /** Unity "Inherit Color". */
    @property
    inheritColor = false;

    @property
    probability = 1;
}

interface Track {
    seed: number;
    gen: number;
    pos: Vec3;
    prev: Vec3;
    agePrev: number;
    age: number;
    color: Color;
    insts: Inst[];
}

interface BurstInfo { time: number; count: any; repeatCount: number; repeatInterval: number; }

interface Source {
    ps: ParticleSystem;
    duration: number;
    delay: number;
    rateOverTime: any;
    rateOverDistance: any;
    bursts: BurstInfo[];
    baseColor: Color | null;
}

interface Inst {
    entry: number;
    id: number;
    pos: Vec3;
    prev: Vec3;
    color: Color;
    t: number;          // instance simulated time
    following: boolean;
    track: Track | null;
    rateAcc: number;
    distAcc: number;
    burstFired: number[];
}

const _m = new Mat4();
const _m2 = new Mat4();
const _v = new Vec3();
const _b = new Vec3();
const _keep = new Vec3();
const _c = new Color();
const SIM_WORLD = 0;
let _instIds = 1;

function particlePool(ps: ParticleSystem): { length: number; data: any[]; removeAt?: (i: number) => void } | null {
    const proc = (ps as any)?.processor;
    return proc && proc._particles ? proc._particles : null;
}

function normAge(p: any): number {
    const life = p.startLifetime || 0;
    if (life <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - p.remainingLifetime / life));
}

function evalCurve(c: any, t: number): number {
    if (!c || typeof c.evaluate !== 'function') return 0;
    return c.evaluate(t, Math.random()) || 0;
}

@ccclass('VfxSubEmitter')
@executeInEditMode
@executionOrder(-100)
@menu('VFX/VfxSubEmitter')
export class VfxSubEmitter extends Component {
    @property({ type: [VfxSubEmitterEntry] })
    entries: VfxSubEmitterEntry[] = [];

    /** Cap of simultaneous instances per entry (protects low-end devices). */
    @property
    maxInstancesPerEntry = 64;

    /** A parent particle moving farther than this in one frame is treated as a teleport. */
    @property
    teleportDistance = 25;

    private _ps: ParticleSystem | null = null;
    private _tracks = new Map<any, Track>();
    private _gen = 0;
    private _sources: (Source | null)[] = [];
    private _insts: Inst[] = [];
    private _count: number[] = [];

    /** True while any instance is still emitting. */
    get busy(): boolean {
        return this._insts.length > 0 || this._tracks.size > 0;
    }

    onLoad() {
        this._prepare();
    }

    onDisable() {
        this._insts.length = 0;
        this._tracks.clear();
    }

    private _prepare() {
        this._ps = this.getComponent(ParticleSystem);
        this._sources = this.entries.map((e) => this._makeSource(e && e.emitter));
        this._count = this.entries.map(() => 0);
    }

    /** Turn the entry system into a passive shared system and remember its emission settings. */
    private _makeSource(ps: ParticleSystem | null): Source | null {
        if (!ps || !ps.isValid) return null;
        const any: any = ps;
        if (any.__vfxSource) return any.__vfxSource; // shared by several entries / parents
        const bursts: BurstInfo[] = (ps.bursts || []).map((b: any) => ({
            time: b.time || 0,
            count: b.count,
            repeatCount: Math.max(1, b.repeatCount || 1),
            repeatInterval: b.repeatInterval || 0,
        }));
        const sc: any = ps.startColor;
        // Emission settings are only READ (never zeroed) so saving the prefab cannot lose them;
        // self-emission is blocked every frame in update() instead.
        const src: Source = {
            ps,
            duration: ps.duration || 1,
            delay: evalCurve(ps.startDelay, 0),
            rateOverTime: ps.rateOverTime,
            rateOverDistance: ps.rateOverDistance,
            bursts,
            baseColor: sc && sc.mode === 0 && sc.color ? sc.color.clone() : null,
        };
        // World space so moving the node between emits does not drag live particles.
        if (any.processor) ps.simulationSpace = SIM_WORLD as any;
        else any._simulationSpace = SIM_WORLD;
        any.__vfxSource = src;
        if (!ps.node.active) ps.node.active = true; // importer leaves templates inactive
        return src;
    }

    // Runs before ParticleSystem.update (executionOrder 99): shared systems keep simulating
    // their particles but never emit by themselves (Unity sub-emitter systems don't either).
    update() {
        for (const src of this._sources) {
            if (!src || !src.ps.isValid || !src.ps.enabledInHierarchy) continue;
            const any: any = src.ps;
            if (!src.ps.isPlaying) src.ps.play();
            any._isEmitting = false;
        }
    }

    lateUpdate(dt: number) {
        if (this._sources.length !== this.entries.length) this._prepare();
        const ps = this._ps;
        if (!ps) return;
        const pool = particlePool(ps);
        if (pool) this._scanParticles(ps, pool, dt);
        this._tickInstances(dt);
    }

    private _scanParticles(ps: ParticleSystem, pool: { length: number; data: any[] }, dt: number) {
        const gen = ++this._gen;
        const world = (ps as any).simulationSpace === SIM_WORLD;
        const maxAge = dt * ps.simulationSpeed;
        if (!world) ps.node.getWorldMatrix(_m);
        for (let i = 0; i < pool.length; i++) {
            const p = pool.data[i];
            if (!p || p.remainingLifetime < 0) continue;
            let t = this._tracks.get(p);
            if (t && t.seed !== p.randomSeed) {
                // Pooled particle object reused within one frame: the old particle died.
                this._onDeath(t);
                this._tracks.delete(p);
                t = undefined;
            }
            if (world) Vec3.copy(_v, p.position);
            else Vec3.transformMat4(_v, p.position, _m);
            if (!t) {
                t = { seed: p.randomSeed, gen, pos: _v.clone(), prev: _v.clone(), agePrev: 0, age: normAge(p), color: new Color(), insts: [] };
                // First sight is up to one frame after emission: on fast (sped-up) systems the
                // particle may already be far from its birth point. Point-like shapes are born at
                // the shape origin; otherwise back-extrapolate (capped at one frame of sim time).
                const age = Math.min((p.startLifetime || 0) - p.remainingLifetime, maxAge);
                const vel: Vec3 = p.ultimateVelocity && p.ultimateVelocity.lengthSqr() > 0 ? p.ultimateVelocity : p.velocity;
                if (age > 0 && this._pointShapeOrigin(ps, _b)) {
                    Vec3.copy(t.prev, _b);
                } else if (age > 0 && vel) {
                    if (world) Vec3.copy(_b, vel);
                    else Vec3.transformMat4Normal(_b, vel, _m);
                    Vec3.scaleAndAdd(t.prev, t.pos, _b, -age);
                }
                if (p.color) t.color.set(p.color);
                this._tracks.set(p, t);
                this._onBirth(t);
            } else {
                Vec3.copy(t.prev, t.pos);
                Vec3.copy(t.pos, _v);
                t.agePrev = t.age;
                t.age = normAge(p);
                if (p.color) t.color.set(p.color);
            }
            t.gen = gen;
        }
        for (const [key, t] of this._tracks) {
            if (t.gen !== gen) {
                this._onDeath(t);
                this._tracks.delete(key);
            }
        }
    }

    /** World position of the shape origin when the shape is a point (radius / size ~ 0). */
    private _pointShapeOrigin(ps: ParticleSystem, out: Vec3): boolean {
        const sh: any = ps.shapeModule;
        if (!sh || !sh.enable) return false;
        const type = sh.shapeType; // 0 Box, 1 Circle, 2 Cone, 3 Sphere, 4 Hemisphere
        if (type === 0) {
            const s = sh.scale;
            if (!s || Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)) > 0.01) return false;
        } else if (!(sh.radius <= 0.01)) {
            return false;
        }
        if (type === 2 && sh.emitFrom !== 0 && sh.length > 0.01) return false; // cone volume
        ps.node.getWorldMatrix(_m2);
        Vec3.transformMat4(out, sh.position || Vec3.ZERO, _m2);
        return true;
    }

    private _onBirth(t: Track) {
        for (let i = 0; i < this.entries.length; i++) {
            const e = this.entries[i];
            if (e && e.type === VfxSubEmitterType.Birth) this._spawn(i, t, true);
        }
    }

    private _onDeath(t: Track) {
        for (const inst of t.insts) { inst.following = false; inst.track = null; }
        t.insts.length = 0;
        for (let i = 0; i < this.entries.length; i++) {
            const e = this.entries[i];
            if (e && e.type === VfxSubEmitterType.Death) this._spawn(i, t, false);
        }
    }

    private _spawn(i: number, t: Track, following: boolean) {
        const e = this.entries[i];
        const src = this._sources[i];
        if (!e || !src || !src.ps.isValid) return;
        if (e.probability < 1 && Math.random() > e.probability) return;
        if (this._count[i] >= this.maxInstancesPerEntry) return;
        const inst: Inst = {
            entry: i,
            id: _instIds++,
            pos: (following ? t.prev : t.pos).clone(),
            prev: (following ? t.prev : t.pos).clone(),
            color: t.color.clone(),
            t: 0,
            following,
            track: following ? t : null,
            rateAcc: 0,
            distAcc: 0,
            burstFired: src.bursts.map(() => 0),
        };
        if (following) t.insts.push(inst);
        this._insts.push(inst);
        this._count[i]++;
    }

    private _tickInstances(dt: number) {
        for (let k = this._insts.length - 1; k >= 0; k--) {
            const inst = this._insts[k];
            const src = this._sources[inst.entry];
            if (!src || !src.ps.isValid) { this._remove(k); continue; }
            if (this._stepInstance(inst, src, dt)) this._remove(k);
        }
    }

    private _remove(k: number) {
        const inst = this._insts[k];
        this._insts.splice(k, 1);
        this._count[inst.entry] = Math.max(0, this._count[inst.entry] - 1);
    }

    /** Emits this frame's particles for one instance; returns true when it is finished. */
    private _stepInstance(inst: Inst, src: Source, dt: number): boolean {
        const ps = src.ps;
        const any: any = ps;
        const sim = dt * ps.simulationSpeed;
        const t0 = inst.t;
        const t1 = t0 + sim;
        inst.t = t1;
        const tr = inst.track;
        if (inst.following && tr) {
            Vec3.copy(inst.prev, inst.pos);
            Vec3.copy(inst.pos, tr.pos);
        } else {
            Vec3.copy(inst.prev, inst.pos);
        }
        const e = this.entries[inst.entry];
        const active = t1 >= src.delay && (inst.following || t0 < src.delay + src.duration);

        // Emission settings borrowed by this instance (restored at the end).
        const savedTime = any._time;
        let savedColor: Color | null = null;
        if (e.inheritColor && src.baseColor) {
            const sc: any = ps.startColor;
            savedColor = sc.color.clone();
            const b = src.baseColor;
            _c.set(b.r * inst.color.r / 255, b.g * inst.color.g / 255, b.b * inst.color.b / 255, b.a * inst.color.a / 255);
            sc.color = _c;
        }
        ps.node.getWorldPosition(_keep);
        const ageA = tr ? tr.agePrev : 0;
        const ageB = tr ? tr.age : 0;

        if (active) {
            const dist = Vec3.distance(inst.prev, inst.pos);
            const teleport = dist > this.teleportDistance;
            // Bursts (time from instance start, after start delay).
            src.bursts.forEach((b, bi) => {
                while (inst.burstFired[bi] < b.repeatCount) {
                    const bt = src.delay + b.time + inst.burstFired[bi] * b.repeatInterval;
                    if (bt > t1) break;
                    inst.burstFired[bi]++;
                    const n = Math.round(evalCurve(b.count, 0));
                    if (n > 0) this._emitAt(inst, src, inst.pos, n, (bt - src.delay) / src.duration, t1 - bt, ageB);
                }
            });
            // Rate over time.
            const rate = evalCurve(src.rateOverTime, Math.min(1, t1 / src.duration));
            if (rate > 0) {
                inst.rateAcc += rate * sim;
                const n = Math.floor(inst.rateAcc);
                if (n > 0) { inst.rateAcc -= n; this._emitAt(inst, src, inst.pos, n, (t1 - src.delay) / src.duration, 0, ageB); }
            }
            // Rate over distance, spread along the path like Unity (aged per point).
            const rod = evalCurve(src.rateOverDistance, 0);
            if (rod > 0 && dist > 0 && !teleport) {
                inst.distAcc += dist * rod;
                const n = Math.floor(inst.distAcc);
                if (n > 0) {
                    inst.distAcc -= n;
                    for (let k = 1; k <= n; k++) {
                        Vec3.lerp(_v, inst.prev, inst.pos, k / n);
                        this._emitAt(inst, src, _v, 1, null, (1 - k / n) * sim, ageA + (ageB - ageA) * (k / n));
                    }
                }
            }
        }

        any._time = savedTime;
        if (savedColor) (ps.startColor as any).color = savedColor;
        ps.node.setWorldPosition(_keep);

        if (inst.following && tr) return false;
        return t1 >= src.delay + src.duration && inst.burstFired.every((f, bi) => f >= src.bursts[bi].repeatCount);
    }

    /**
     * Emit `count` particles of the shared system at `pos`. Start curves are evaluated at the
     * parent particle's normalized age for Birth instances (Unity), else at the instance time;
     * `age` (simulated seconds already elapsed) is removed from their lifetime.
     */
    private _emitAt(inst: Inst, src: Source, pos: Vec3, count: number, timeNorm: number | null, age: number, parentAge: number) {
        const ps = src.ps;
        const any: any = ps;
        const emit = any.emit;
        if (typeof emit !== 'function') return;
        const pool = particlePool(ps);
        const tn = inst.following ? parentAge : (timeNorm || 0);
        any._time = Math.min(0.999, Math.max(0, tn)) * src.duration;
        ps.node.setWorldPosition(pos);
        const before = pool ? pool.length : 0;
        emit.call(ps, count, 0);
        if (!pool) return;
        for (let i = pool.length - 1; i >= before; i--) {
            const p = pool.data[i];
            p.__vfxRibbon = inst.id; // VfxRibbon draws one ribbon per instance (Unity split ribbons)
            if (age > 0) {
                if (p.remainingLifetime <= age) { pool.removeAt!(i); continue; }
                p.remainingLifetime -= age;
            }
        }
    }
}
