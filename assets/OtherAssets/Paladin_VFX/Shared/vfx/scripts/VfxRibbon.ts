/**
 * Unity Trails module in Ribbon mode for Cocos ParticleSystem (Cocos trails are per particle only).
 * Written by cocos-vfx-importer-plus; template in extensions/cocos-vfx-importer-plus/runtime.
 *
 * Joins the live particles of the ParticleSystem on this node, oldest to newest, into ribbons
 * drawn by hidden cc.Line children. Particles emitted by VfxSubEmitter carry `__vfxRibbon`
 * (one id per parent particle) and get one ribbon each, like Unity "Split Sub Emitter Ribbons".
 * Width = particle size * widthMultiplier ("Size affects Width"), colour = particle colour
 * ("Inherit Particle Color"). Material = the ParticleSystem's trail slot (1), else slot 0.
 * Lines are created once in onEnable (never during update).
 */
import { _decorator, CCObject, Color, Component, Line, Mat4, Node, ParticleSystem, Vec3 } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property, executeInEditMode, menu } = _decorator;

const MAX_POINTS = 100; // cc.Line model capacity
const SIM_WORLD = 0;
const _m = new Mat4();

interface Strip {
    node: Node;
    line: Line;
    positions: Vec3[];
    widths: number[];
    colors: Color[];
    count: number;
}

@ccclass('VfxRibbon')
@executeInEditMode
@menu('VFX/VfxRibbon')
export class VfxRibbon extends Component {
    /** Unity trails.widthOverTrail (constant part). */
    @property
    widthMultiplier = 1;

    @property
    sizeAffectsWidth = true;

    @property
    inheritParticleColor = true;

    /** Unity textureMode RepeatPerSegment / Tile: texture repeats once per segment. */
    @property
    repeatPerSegment = false;

    /** Ribbons drawn at most at once (extra groups are skipped). */
    @property
    maxRibbons = 6;

    private _ps: ParticleSystem | null = null;
    private _strips: Strip[] = [];
    private _groups = new Map<any, any[]>();

    onEnable() {
        this._ps = this.getComponent(ParticleSystem);
        if (!this._ps) return;
        if (!this._strips.length) {
            for (let i = 0; i < Math.max(1, this.maxRibbons); i++) this._strips.push(this._createStrip(i));
        }
        for (const s of this._strips) if (s.node.isValid) s.node.active = true;
    }

    onDisable() {
        for (const s of this._strips) if (s.node.isValid) s.node.active = false;
    }

    onDestroy() {
        for (const s of this._strips) if (s.node.isValid) s.node.destroy();
        this._strips.length = 0;
    }

    private _createStrip(i: number): Strip {
        const node = new Node(`__ribbon${i}`);
        node.hideFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
        if (EDITOR) node.hideFlags |= CCObject.Flags.LockedInEditor;
        node.active = false;
        const line = node.addComponent(Line);
        line.worldSpace = true;
        const ps = this._ps!;
        const mat = ps.getSharedMaterial(1) || ps.getSharedMaterial(0);
        if (mat) {
            line.lineMaterial = mat;
            const tex = mat.getProperty('mainTexture') as any;
            if (tex) line.texture = tex;
        }
        const strip: Strip = { node, line, positions: [], widths: [], colors: [], count: 0 };
        // Per-point width / colour: the line model only calls evaluate(t) on these.
        (line as any)._width = {
            evaluate(t: number) {
                const n = strip.count;
                if (n < 1) return 0;
                return strip.widths[Math.min(n - 1, Math.max(0, Math.round(t * n)))];
            },
        };
        (line as any)._color = {
            evaluate(t: number) {
                const n = strip.count;
                if (n < 1) return Color.TRANSPARENT;
                return strip.colors[Math.min(n - 1, Math.max(0, Math.round(t * n)))];
            },
        };
        this.node.addChild(node);
        return strip;
    }

    lateUpdate() {
        const ps = this._ps;
        if (!ps || !this._strips.length) return;
        const proc: any = (ps as any).processor;
        const pool = proc && proc._particles;
        const groups = this._groups;
        for (const list of groups.values()) list.length = 0;
        if (pool) {
            for (let i = 0; i < pool.length; i++) {
                const p = pool.data[i];
                if (!p || p.remainingLifetime < 0) continue;
                const key = p.__vfxRibbon || 0;
                let list = groups.get(key);
                if (!list) { list = []; groups.set(key, list); }
                list.push(p);
            }
        }
        const world = (ps as any).simulationSpace === SIM_WORLD;
        if (!world) ps.node.getWorldMatrix(_m);
        let s = 0;
        for (const [key, list] of groups) {
            if (!list.length) { groups.delete(key); continue; }
            if (s >= this._strips.length) break;
            this._fill(this._strips[s++], list, world);
        }
        for (; s < this._strips.length; s++) {
            const strip = this._strips[s];
            if (strip.count) { strip.count = 0; strip.line.positions = []; }
        }
    }

    private _fill(strip: Strip, order: any[], world: boolean) {
        // Oldest first (Unity ribbons follow particle age).
        order.sort((a, b) => (b.startLifetime - b.remainingLifetime) - (a.startLifetime - a.remainingLifetime));
        let n = order.length;
        const step = n > MAX_POINTS ? n / MAX_POINTS : 1;
        if (n > MAX_POINTS) n = MAX_POINTS;
        while (strip.positions.length < n) {
            strip.positions.push(new Vec3());
            strip.colors.push(new Color());
            strip.widths.push(0);
        }
        for (let k = 0; k < n; k++) {
            const p = order[Math.floor(k * step)];
            const out = strip.positions[k];
            if (world) Vec3.copy(out, p.position);
            else Vec3.transformMat4(out, p.position, _m);
            const size = this.sizeAffectsWidth && p.size ? p.size.x : 1;
            strip.widths[k] = size * this.widthMultiplier;
            if (this.inheritParticleColor && p.color) strip.colors[k].set(p.color);
            else strip.colors[k].set(255, 255, 255, 255);
        }
        strip.count = n;
        const line = strip.line;
        if (this.repeatPerSegment) {
            const tile = line.tile;
            if (tile.x !== Math.max(1, n - 1)) line.tile = tile.clone().set(Math.max(1, n - 1), 1);
        }
        // Setter rebuilds the vertex data from positions + evaluators above.
        line.positions = n > 1 ? strip.positions.slice(0, n) : [];
    }
}
