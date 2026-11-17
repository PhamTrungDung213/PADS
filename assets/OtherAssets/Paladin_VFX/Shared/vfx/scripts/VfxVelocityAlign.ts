/**
 * Unity Render Alignment "Velocity" for mesh particles (Cocos has no such mode).
 * Written by cocos-vfx-importer-plus; template in extensions/cocos-vfx-importer-plus/runtime.
 *
 * Needs the ParticleSystem renderer alignSpace = World. Like Unity, each particle's own start
 * rotation is kept and the whole mesh is then turned so `axis` follows the velocity:
 *   rotation = align(axis → velocity) * startRotation
 * (expressed relative to the node's world rotation, which the shader applies on top).
 */
import { _decorator, Component, ParticleSystem, Quat, Vec3 } from 'cc';

const { ccclass, property, executeInEditMode, menu } = _decorator;

const SIM_WORLD = 0;
const DEG2RAD = Math.PI / 180;
const _qx = new Quat();
const _qy = new Quat();
const _qz = new Quat();
const _dir = new Vec3();
const _q = new Quat();
const _qs = new Quat();
const _inv = new Quat();
const _e = new Vec3();

interface Base { seed: number; q: Quat; }

@ccclass('VfxVelocityAlign')
@executeInEditMode
@menu('VFX/VfxVelocityAlign')
export class VfxVelocityAlign extends Component {
    /** Mesh axis that follows the velocity (Unity +Z = Cocos -Z after the importer's Z flip). */
    @property
    axis = new Vec3(0, 0, -1);

    private _ps: ParticleSystem | null = null;
    private _base = new Map<any, Base>();

    onLoad() {
        this._ps = this.getComponent(ParticleSystem);
    }

    onDisable() {
        this._base.clear();
    }

    lateUpdate() {
        const ps = this._ps;
        if (!ps) return;
        const proc: any = (ps as any).processor;
        const pool = proc && proc._particles;
        if (!pool || !pool.length) {
            if (this._base.size) this._base.clear();
            return;
        }
        Quat.invert(_inv, ps.node.worldRotation);
        const world = (ps as any).simulationSpace === SIM_WORLD;
        const axis = this.axis;
        for (let i = 0; i < pool.length; i++) {
            const p = pool.data[i];
            if (!p) continue;
            let b = this._base.get(p);
            if (!b || b.seed !== p.randomSeed) {
                // First sight of this particle: remember its emitted (start) rotation.
                // Unity applies start rotation Z, then X, then Y (Cocos fromEuler uses another order).
                const r = p.startEuler || p.rotation;
                const q = new Quat();
                Quat.fromAxisAngle(_qy, Vec3.UNIT_Y, r.y);
                Quat.fromAxisAngle(_qx, Vec3.UNIT_X, r.x);
                Quat.fromAxisAngle(_qz, Vec3.UNIT_Z, r.z);
                Quat.multiply(q, _qy, _qx);
                Quat.multiply(q, q, _qz);
                b = { seed: p.randomSeed, q };
                this._base.set(p, b);
            }
            const v: Vec3 = p.ultimateVelocity && p.ultimateVelocity.lengthSqr() > 1e-10 ? p.ultimateVelocity : p.velocity;
            if (!v || v.lengthSqr() < 1e-10) continue;
            Vec3.normalize(_dir, v);
            if (world) Vec3.transformQuat(_dir, _dir, _inv);
            Quat.rotationTo(_q, axis, _dir);
            Quat.multiply(_qs, _q, b.q);
            Quat.toEuler(_e, _qs);
            p.rotation.set(_e.x * DEG2RAD, _e.y * DEG2RAD, _e.z * DEG2RAD);
        }
        if (this._base.size > pool.length * 2 + 64) this._base.clear();
    }
}
