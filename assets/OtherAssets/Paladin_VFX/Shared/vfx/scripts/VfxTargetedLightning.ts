/**
 * Port of DangerDungeon TargetedLightningSpell (Guungshi Magic Spell) for Cocos.
 * Written by cocos-vfx-importer-plus; template in extensions/cocos-vfx-importer-plus/runtime.
 *
 * This node sits on the TARGET. The emitter looks at `startPosition` (the caster / previous
 * chain target) and its shape is pushed out to that distance, so its particles fly from the
 * start back to this node; their Birth sub-emitters (VfxSubEmitter) leave the points that
 * VfxRibbon joins into the bolt. Particles reaching the centre are cut to `remainingLife`.
 * Unity's script re-simulates the emitter (with children) at deltaTime * 7 each frame on top
 * of simulationSpeed = simulateSpeed; that is baked here as simulationSpeed multipliers.
 */
import { _decorator, Component, Mat4, Node, ParticleSystem, Vec3 } from 'cc';

const { ccclass, property, executeInEditMode, executionOrder, menu } = _decorator;

const SIM_WORLD = 0;
const _m = new Mat4();
const _inv = new Mat4();
const _v = new Vec3();
const _c = new Vec3();
const _d = new Vec3();
const _dir = new Vec3();

@ccclass('VfxTargetedLightning')
@executeInEditMode
@executionOrder(-10)
@menu('VFX/VfxTargetedLightning')
export class VfxTargetedLightning extends Component {
    @property({ type: ParticleSystem })
    lightningEmitter: ParticleSystem | null = null;

    @property({ type: ParticleSystem })
    lightningSparks: ParticleSystem | null = null;

    @property({ type: ParticleSystem })
    lightningPoints: ParticleSystem | null = null;

    /** Where the bolt starts (caster). Leave empty to keep the authored offset. */
    @property({ type: Node })
    startPosition: Node | null = null;

    @property
    killDistance = 0.05;

    @property
    remainingLife = 0.2;

    @property
    simulateSpeed = 10;

    /** Unity script: Simulate(deltaTime * factor) every frame (the system runs paused). */
    @property
    factor = 7;

    // Serialized so a prefab saved after the speeds were baked is never multiplied twice.
    @property({ visible: false })
    private _applied = false;

    onLoad() {
        this._applySpeeds();
    }

    onEnable() {
        const e = this.lightningEmitter;
        if (!e) return;
        e.node.setPosition(Vec3.ZERO);
        e.node.setRotationFromEuler(0, 0, 0);
        const shape: any = e.shapeModule;
        if (shape && shape.position) shape.position = new Vec3(0, 0, 0);
        this._aim();
    }

    /** Re-target at runtime (chain lightning hops). */
    setStart(start: Node | null) {
        this.startPosition = start;
        this._aim();
    }

    update() {
        this._aim();
    }

    lateUpdate() {
        this._killOnCenter();
    }

    private _applySpeeds() {
        if (this._applied || !this.lightningEmitter) return;
        this._applied = true;
        const scripted = new Set<ParticleSystem>(
            [this.lightningEmitter, this.lightningPoints, this.lightningSparks].filter(Boolean) as ParticleSystem[],
        );
        // Simulate(withChildren = true): every system under the emitter runs `factor` times faster.
        const all = this.lightningEmitter.node.getComponentsInChildren(ParticleSystem);
        for (const ps of all) {
            const base = scripted.has(ps) ? this.simulateSpeed : ps.simulationSpeed;
            ps.simulationSpeed = base * this.factor;
        }
    }

    private _aim() {
        const e = this.lightningEmitter;
        const s = this.startPosition;
        if (!e || !s) return;
        s.getWorldPosition(_v);
        // Cocos lookAt points -Z at the target; the importer maps Unity +Z to Cocos -Z,
        // so this matches Unity's Transform.LookAt.
        e.node.lookAt(_v, Vec3.UNIT_Y);
        e.node.getWorldMatrix(_m);
        Mat4.invert(_inv, _m);
        Vec3.transformMat4(_c, _v, _inv);
        const shape: any = e.shapeModule;
        if (shape) shape.position = new Vec3(0, 0, _c.z);
    }

    private _killOnCenter() {
        const e = this.lightningEmitter;
        if (!e) return;
        const proc: any = (e as any).processor;
        const pool = proc && proc._particles;
        if (!pool) return;
        const world = (e as any).simulationSpace === SIM_WORLD;
        e.node.getWorldMatrix(_m);
        Mat4.invert(_inv, _m);
        e.node.getWorldPosition(_c);
        // Direction centre → start. Unity sub-steps Simulate() (fixed 0.02 s), so its particles
        // meet the kill radius; one sped-up Cocos frame can jump past the target instead. Treat
        // "reached or crossed the target along the bolt" as arrival and pin the particle there.
        const s = this.startPosition;
        let hasDir = false;
        if (s) {
            s.getWorldPosition(_dir);
            Vec3.subtract(_dir, _dir, _c);
            hasDir = _dir.lengthSqr() > 1e-8;
            if (hasDir) _dir.normalize();
        }
        for (let i = 0; i < pool.length; i++) {
            const p = pool.data[i];
            if (!p) continue;
            if (world) Vec3.copy(_v, p.position);
            else Vec3.transformMat4(_v, p.position, _m);
            Vec3.subtract(_d, _v, _c);
            const along = hasDir ? Vec3.dot(_d, _dir) : _d.length();
            const arrived = hasDir ? along < this.killDistance : along < this.killDistance;
            if (!arrived) continue;
            if (p.remainingLifetime > this.remainingLife) p.remainingLifetime = this.remainingLife;
            if (hasDir && along < 0) {
                if (world) Vec3.copy(p.position, _c);
                else Vec3.transformMat4(p.position, _c, _inv);
            }
        }
    }
}
