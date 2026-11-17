import { _decorator, Component, Node, Vec3, Color, Material, Mesh, MeshRenderer, tween, easing, utils, director, Prefab, instantiate, assetManager } from 'cc';

const { ccclass, property } = _decorator;

export interface RingOptions {
    from?: number;
    to?: number;
    duration?: number;
    color?: Color;
    lift?: number;
    follow?: Node;
    easing?: 'linear' | 'quadOut' | 'cubicOut' | 'backOut' | 'sineOut' | 'expoOut';
    spin?: number;
    holdAlpha?: number;
}

export interface SwooshOptions {
    radius?: number;
    angle?: number;
    travel?: number;
    duration?: number;
    color?: Color;
    lift?: number;
    full?: boolean;
}

export interface StreakOptions {
    radius?: number;
    duration?: number;
    color?: Color;
    lift?: number;
    kind?: 'crack' | 'spike';
}

const _c = new Color();

@ccclass('PaladinGroundFx')
export class PaladinGroundFx extends Component {
    public static instance: PaladinGroundFx = null;

    @property({ type: Material, tooltip: 'Material vòng hào quang sàn (WA_Ring.mtl)' })
    public ringMaterial: Material = null;

    @property({ type: Material, tooltip: 'Material vệt quạt kiếm / tia nứt (WA_Swoosh.mtl)' })
    public swooshMaterial: Material = null;

    public static material: Material = null;
    public static swooshMat: Material = null;
    public static root: Node = null;

    /** Tối đa 36 prefab VFX sống cùng lúc theo tiêu chuẩn Playable Ad */
    public static readonly PREFAB_BUDGET: number = 36;
    private static _alivePrefabs: number = 0;

    private static _quad: Mesh = null;
    private static _arc: Mesh = null;
    private static _arcFull: Mesh = null;
    private static _cracks: Mesh[] = [];
    private static _spikes: Mesh[] = [];

    onLoad() {
        PaladinGroundFx.instance = this;
        PaladinGroundFx.root = this.node;

        if (this.ringMaterial) PaladinGroundFx.material = this.ringMaterial;
        if (this.swooshMaterial) PaladinGroundFx.swooshMat = this.swooshMaterial;

        PaladinGroundFx.ensureMaterials();
    }

    public static ensureMaterials() {
        if (!PaladinGroundFx.material) {
            assetManager.loadAny('cc99f104-4ee8-455f-ae72-fcb9b9f209fb', (err, asset: Material) => {
                if (!err && asset) PaladinGroundFx.material = asset;
            });
        }
        if (!PaladinGroundFx.swooshMat) {
            assetManager.loadAny('3c3dea72-cd01-43b3-87cf-928c1fd1a2a9', (err, asset: Material) => {
                if (!err && asset) PaladinGroundFx.swooshMat = asset;
            });
        }
    }

    /** Tạo node vòng hào quang cố định bám theo Hero */
    public static makeRingNode(name: string, parent: Node, radius: number, color: Color, lift: number = 0.08): Node | null {
        if (!this.material) this.ensureMaterials();
        if (!this.material) return null;

        const { node, mat, kx, kz } = this.makeNode(name, this.quad, this.material, Vec3.ZERO, lift, parent);
        node.setScale(kx * radius * 2, 1, kz * radius * 2);
        this.setColor(mat, color, 1.0);
        return node;
    }

    onDestroy() {
        if (PaladinGroundFx.instance === this) {
            PaladinGroundFx.instance = null;
        }
        PaladinGroundFx._alivePrefabs = 0;
    }

    // =========================================================================
    // 1. VÒNG HÀO QUANG SÀN (GROUND RING)
    // =========================================================================
    public static ring(center: Vec3, opts: RingOptions = {}): Node | null {
        if (!this.material) {
            this.ensureMaterials();
            return null;
        }
        const from = opts.from ?? 0.5;
        const to = opts.to ?? 3;
        const duration = Math.max(0.05, opts.duration ?? 0.4);
        const hold = Math.max(0, Math.min(0.95, opts.holdAlpha ?? 0));
        const spin = opts.spin || 0;
        const easeFunc = this.getEase(opts.easing || 'quadOut');
        const color = opts.color ? opts.color.clone() : new Color(255, 255, 255, 255);

        const { node, mat, kx, kz } = this.makeNode('WA_Ring', this.quad, this.material, center, opts.lift ?? 0.05, opts.follow);
        const apply = (t: number) => {
            if (!node || !node.isValid) return;
            const d = Math.max(0.01, (from + (to - from) * easeFunc(t)) * 2);
            node.setScale(kx * d, 1, kz * d);
            if (spin !== 0) node.setRotationFromEuler(0, spin * duration * t, 0);
            const a = t <= hold ? 1 : Math.max(0, 1 - (t - hold) / (1 - hold));
            this.setColor(mat, color, a);
        };
        this.run(node, duration, apply);
        return node;
    }

    // =========================================================================
    // 2. VỆT QUẠT CHÉM SÁCH (SWOOSH ARC)
    // =========================================================================
    public static swoosh(center: Vec3, opts: SwooshOptions = {}): Node | null {
        if (!this.swooshMat) {
            this.ensureMaterials();
            return null;
        }
        const full = !!opts.full;
        const radius = opts.radius ?? 2.4;
        const duration = Math.max(0.05, opts.duration ?? (full ? 0.28 : 0.18));
        const travel = opts.travel ?? (full ? 420 : 70);
        const baseDeg = ((opts.angle ?? 0) * 180) / Math.PI;
        const color = opts.color ? opts.color.clone() : new Color(255, 255, 255, 255);

        const { node, mat } = this.makeNode('WA_Swoosh', full ? this.arcFull : this.arc, this.swooshMat, center, opts.lift ?? 0.8, null);
        const apply = (t: number) => {
            if (!node || !node.isValid) return;
            const yaw = -(baseDeg + (t - 0.55) * travel);
            node.setRotationFromEuler(0, yaw, 0);
            const r = radius * (0.85 + 0.2 * easing.cubicOut(t));
            node.setScale(r, 1, r);
            const a = t < 0.35 ? 1 : Math.max(0, 1 - (t - 0.35) / 0.65);
            this.setColor(mat, color, a);
        };
        this.run(node, duration, apply);
        return node;
    }

    // =========================================================================
    // 3. TIA NỨT / GAI SÁNG (STREAKS)
    // =========================================================================
    public static streaks(center: Vec3, opts: StreakOptions = {}): Node | null {
        if (!this.swooshMat) return null;
        const kind = opts.kind || 'crack';
        const pool = kind === 'spike' ? this.spikeMeshes : this.crackMeshes;
        const mesh = pool[Math.floor(Math.random() * pool.length)];
        const radius = opts.radius ?? 4;
        const duration = Math.max(0.1, opts.duration ?? 0.6);
        const color = opts.color ? opts.color.clone() : new Color(255, 200, 120, 255);

        const { node, mat } = this.makeNode('WA_Streaks', mesh, this.swooshMat, center, opts.lift ?? 0.06, null);
        node.setRotationFromEuler(0, Math.random() * 360, 0);
        const apply = (t: number) => {
            if (!node || !node.isValid) return;
            const grow = kind === 'spike' ? easing.backOut(Math.min(1, t / 0.25)) : easing.expoOut(Math.min(1, t / 0.18));
            const r = Math.max(0.01, radius * grow);
            node.setScale(r, 1, r);
            const a = t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.55);
            this.setColor(mat, color, a);
        };
        this.run(node, duration, apply);
        return node;
    }

    // =========================================================================
    // 4. PHÁT PREFAB VFX CÓ QUẢN LÝ NGÂN SÁCH (MAX 36 INSTANCES)
    // =========================================================================
    public static prefab(prefab: Prefab, pos: Vec3, scale: number = 1, lifetime: number = 1.5, follow: Node = null): Node | null {
        if (!prefab) return null;
        if (this._alivePrefabs >= this.PREFAB_BUDGET) return null;

        const node = instantiate(prefab);
        const parent = follow && follow.isValid ? follow : this.resolveRoot();
        node.setParent(parent);

        if (follow && follow.isValid) {
            node.setPosition(Vec3.ZERO);
        } else {
            node.setWorldPosition(pos);
        }

        if (scale !== 1) {
            node.setScale(scale, scale, scale);
        }
        node.active = true;

        this._alivePrefabs += 1;
        let counted = true;
        const release = () => {
            if (!counted) return;
            counted = false;
            this._alivePrefabs = Math.max(0, this._alivePrefabs - 1);
            if (node && node.isValid) {
                node.destroy();
            }
        };

        node.once(Node.EventType.NODE_DESTROYED, () => {
            if (counted) {
                counted = false;
                this._alivePrefabs = Math.max(0, this._alivePrefabs - 1);
            }
        });

        setTimeout(release, Math.max(0.2, lifetime) * 1000);
        return node;
    }

    // =========================================================================
    // HELPER DỰNG NODE VÀ TÍNH TOÁN TWEEN
    // =========================================================================
    private static makeNode(name: string, mesh: Mesh, material: Material, center: Vec3, lift: number, follow: Node) {
        const node = new Node(name);
        const mr = node.addComponent(MeshRenderer);
        mr.mesh = mesh;
        mr.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
        mr.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
        mr.setSharedMaterial(material, 0);
        const mat = mr.getMaterialInstance(0);

        const parent = follow && follow.isValid ? follow : this.resolveRoot();
        node.setParent(parent);
        node.layer = parent.layer;

        let kx = 1;
        let kz = 1;
        if (follow && follow.isValid) {
            const s = follow.worldScale;
            kx = 1 / Math.max(0.001, Math.abs(s.x));
            kz = 1 / Math.max(0.001, Math.abs(s.z));
            node.setPosition(0, lift / Math.max(0.001, Math.abs(s.y)), 0);
        } else {
            node.setWorldPosition(center.x, center.y + lift, center.z);
        }
        return { node, mat, kx, kz };
    }

    private static run(node: Node, duration: number, apply: (t: number) => void) {
        apply(0);
        const state = { t: 0 };
        tween(state)
            .to(duration, { t: 1 }, { onUpdate: () => apply(state.t) })
            .call(() => {
                if (node && node.isValid) node.destroy();
            })
            .start();
    }

    private static setColor(mat: Material, color: Color, a: number) {
        if (!mat) return;
        const k = Math.max(0, Math.min(1, a));
        _c.set(color.r * k, color.g * k, color.b * k, color.a * k);
        mat.setProperty('mainColor', _c);
    }

    private static getEase(name: string): (k: number) => number {
        return (easing as any)[name] || easing.quadOut;
    }

    private static resolveRoot(): Node {
        if (this.root && this.root.isValid) return this.root;
        const scene = director.getScene();
        return (scene?.getChildByName('System')?.getChildByName('Pool') || scene) as unknown as Node;
    }

    // =========================================================================
    // DỰNG MESH PROCEDURAL (KHÔNG CẦN MODULE PRIMITIVE CỦA ENGINE)
    // =========================================================================
    private static get quad(): Mesh {
        if (!this._quad || !this._quad.isValid) {
            this._quad = utils.MeshUtils.createMesh({
                positions: [-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, -0.5],
                normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                uvs: [0, 1, 1, 1, 1, 0, 0, 0],
                indices: [0, 1, 2, 0, 2, 3],
                minPos: new Vec3(-0.5, 0, -0.5),
                maxPos: new Vec3(0.5, 0, 0.5),
            });
        }
        return this._quad;
    }

    private static get arc(): Mesh {
        if (!this._arc || !this._arc.isValid) this._arc = this.buildArc(150, 0.5, 20);
        return this._arc;
    }

    private static get arcFull(): Mesh {
        if (!this._arcFull || !this._arcFull.isValid) this._arcFull = this.buildArc(320, 0.55, 40);
        return this._arcFull;
    }

    private static get crackMeshes(): Mesh[] {
        if (this._cracks.length === 0 || !this._cracks[0].isValid) {
            this._cracks = [0, 1, 2].map(() => this.buildStreaks(9, 0.12, false));
        }
        return this._cracks;
    }

    private static get spikeMeshes(): Mesh[] {
        if (this._spikes.length === 0 || !this._spikes[0].isValid) {
            this._spikes = [0, 1, 2].map(() => this.buildStreaks(12, 0.14, true));
        }
        return this._spikes;
    }

    private static buildArc(sweepDeg: number, inner: number, seg: number): Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        const sweep = (sweepDeg * Math.PI) / 180;
        for (let i = 0; i <= seg; i++) {
            const t = i / seg;
            const th = -sweep / 2 + sweep * t;
            const c = Math.cos(th);
            const s = Math.sin(th);
            const head = Math.pow(t, 1.6);
            const outer = 1 + 0.06 * Math.sin(Math.PI * t);
            positions.push(c * inner, 0, s * inner, c * outer, 0, s * outer);
            normals.push(0, 1, 0, 0, 1, 0);
            uvs.push(t, 0, t, 1);
            colors.push(1, 1, 1, head * 0.12, 1, 1, 1, head);
            if (i < seg) {
                const a = i * 2;
                indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
            }
        }
        return utils.MeshUtils.createMesh({
            positions, normals, colors, uvs, indices,
            minPos: new Vec3(-1.1, 0, -1.1),
            maxPos: new Vec3(1.1, 0, 1.1),
        });
    }

    private static buildStreaks(n: number, width: number, spikeTip: boolean): Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const len = 0.55 + Math.random() * 0.45;
            const w = width * (0.6 + Math.random() * 0.8);
            const r0 = spikeTip ? 0.35 : 0.12;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const px = -sa;
            const pz = ca;
            const base = positions.length / 3;
            positions.push(ca * r0 + px * w, 0, sa * r0 + pz * w);
            positions.push(ca * r0 - px * w, 0, sa * r0 - pz * w);
            positions.push(ca * len, 0, sa * len);
            normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
            uvs.push(0, 0, 1, 0, 0.5, 1);
            const baseA = spikeTip ? 0.35 : 1;
            const tipA = spikeTip ? 1 : 0.15;
            colors.push(1, 1, 1, baseA, 1, 1, 1, baseA, 1, 1, 1, tipA);
            indices.push(base, base + 1, base + 2);
        }
        return utils.MeshUtils.createMesh({
            positions, normals, colors, uvs, indices,
            minPos: new Vec3(-1, 0, -1),
            maxPos: new Vec3(1, 0, 1),
        });
    }
}
