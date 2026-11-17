import { Color, Component, director, easing, instantiate, Material, Mesh, MeshRenderer, Node, Prefab, tween, utils, Vec3 } from 'cc';

export enum AutoDestructionMode {
    Destroy = 0,
    Disable = 1,
}

export class AutoDestruction extends Component {
    public isArmed: boolean = false;
    public timeDeactive: number = 2;
    public mode: AutoDestructionMode = AutoDestructionMode.Destroy;
}

export type FxEasing = 'linear' | 'quadOut' | 'cubicOut' | 'backOut' | 'sineOut' | 'expoOut';

export interface RingOptions {
    /** Bán kính lúc bắt đầu (m). */
    from?: number;
    /** Bán kính lúc kết thúc (m). */
    to?: number;
    duration?: number;
    color?: Color;
    /** Nâng lên khỏi mặt đất một chút để không bị z-fight với sàn. */
    lift?: number;
    /** Gắn theo node (vd. vòng choáng trên đầu quái) thay vì đứng yên tại chỗ. */
    follow?: Node;
    /** Easing của bán kính (độ mờ luôn chạy tuyến tính theo thời gian). */
    easing?: FxEasing;
    /** Xoay quanh trục Y (độ/giây). */
    spin?: number;
    /** Giữ nguyên độ sáng tới mốc này (0..1 thời lượng) rồi mới mờ dần. */
    holdAlpha?: number;
}

export interface SwooshOptions {
    /** Bán kính ngoài của vệt chém (m). */
    radius?: number;
    /** Hướng tâm vệt chém trên mặt XZ (radian, atan2(z, x)). */
    angle?: number;
    /** Vệt chém quét thêm bấy nhiêu độ trong lúc chạy. */
    travel?: number;
    duration?: number;
    color?: Color;
    lift?: number;
    /** true: vòng gần kín (chém xoay 360°). */
    full?: boolean;
}

export interface StreakOptions {
    radius?: number;
    duration?: number;
    color?: Color;
    lift?: number;
    /** crack: vết nứt sáng ở gốc; spike: gai sáng ở ngọn. */
    kind?: 'crack' | 'spike';
}

const _c = new Color();

/**
 * Hiệu ứng vẽ bằng code (không cần prefab riêng) cho Warrior:
 * - ring: vòng sóng phẳng (material WA_Ring, texture vòng).
 * - swoosh: vệt chém hình cung (material WA_Swoosh, màu theo đỉnh).
 * - streaks: vết nứt / gai toả ra từ tâm (WA_Swoosh).
 * - prefab: phát prefab VFX có sẵn, có giới hạn số lượng sống cùng lúc cho máy yếu.
 */
export class WA_GroundFx {
    /** Material vòng (builtin-unlit add + texture vòng). */
    public static material: Material = null;

    /** Material vệt chém / vết nứt (builtin-unlit add + vertex color). */
    public static swooshMaterial: Material = null;

    /** Node cha cho hiệu ứng đứng yên. Trống = scene. */
    public static root: Node = null;

    /** Tối đa bấy nhiêu prefab VFX sống cùng lúc (quá thì bỏ qua cái mới). */
    public static prefabBudget: number = 36;

    private static _quad: Mesh = null;
    private static _arc: Mesh = null;
    private static _arcFull: Mesh = null;
    private static _cracks: Mesh[] = [];
    private static _spikes: Mesh[] = [];
    private static _alivePrefabs: number = 0;

    // ------------------------------------------------------------------ vòng

    public static ring(center: Vec3, opts: RingOptions = {}): Node {
        if (!this.material) return null;
        const from = opts.from ?? 0.5;
        const to = opts.to ?? 3;
        const duration = Math.max(0.05, opts.duration ?? 0.4);
        const hold = Math.max(0, Math.min(0.95, opts.holdAlpha ?? 0));
        const spin = opts.spin || 0;
        const ease = this.ease(opts.easing || 'quadOut');
        const color = opts.color ? opts.color.clone() : new Color(255, 255, 255, 255);

        const { node, mat, kx, kz } = this.makeNode('WA_Ring', this.quad, this.material, center, opts.lift ?? 0.06, opts.follow);
        const apply = (t: number) => {
            if (!node.isValid) return;
            const d = Math.max(0.01, (from + (to - from) * ease(t)) * 2);
            node.setScale(kx * d, 1, kz * d);
            if (spin !== 0) node.setRotationFromEuler(0, spin * duration * t, 0);
            const a = t <= hold ? 1 : Math.max(0, 1 - (t - hold) / (1 - hold));
            this.setColor(mat, color, a);
        };
        this.run(node, duration, apply);
        return node;
    }

    // ------------------------------------------------------------------ vệt chém

    public static swoosh(center: Vec3, opts: SwooshOptions = {}): Node {
        if (!this.swooshMaterial) return null;
        const full = !!opts.full;
        const radius = opts.radius ?? 2.4;
        const duration = Math.max(0.05, opts.duration ?? (full ? 0.28 : 0.18));
        const travel = opts.travel ?? (full ? 420 : 70);
        const baseDeg = ((opts.angle ?? 0) * 180) / Math.PI;
        const color = opts.color ? opts.color.clone() : new Color(255, 255, 255, 255);

        const { node, mat } = this.makeNode('WA_Swoosh', full ? this.arcFull : this.arc, this.swooshMaterial, center, opts.lift ?? 0.9, null);
        const apply = (t: number) => {
            if (!node.isValid) return;
            // Cocos xoay +Y: góc thế giới của trục +X local = -yaw -> yaw = -(góc muốn).
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

    // ------------------------------------------------------------------ vết nứt / gai

    public static streaks(center: Vec3, opts: StreakOptions = {}): Node {
        if (!this.swooshMaterial) return null;
        const kind = opts.kind || 'crack';
        const pool = kind === 'spike' ? this.spikeMeshes : this.crackMeshes;
        const mesh = pool[Math.floor(Math.random() * pool.length)];
        const radius = opts.radius ?? 4;
        const duration = Math.max(0.1, opts.duration ?? 0.6);
        const color = opts.color ? opts.color.clone() : new Color(255, 200, 120, 255);

        const { node, mat } = this.makeNode('WA_Streaks', mesh, this.swooshMaterial, center, opts.lift ?? 0.07, null);
        node.setRotationFromEuler(0, Math.random() * 360, 0);
        const apply = (t: number) => {
            if (!node.isValid) return;
            // Bung ra rất nhanh rồi đứng yên, mờ dần ở nửa sau.
            const grow = kind === 'spike' ? easing.backOut(Math.min(1, t / 0.25)) : easing.expoOut(Math.min(1, t / 0.18));
            const r = Math.max(0.01, radius * grow);
            node.setScale(r, 1, r);
            const a = t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.55);
            this.setColor(mat, color, a);
        };
        this.run(node, duration, apply);
        return node;
    }

    // ------------------------------------------------------------------ prefab có sẵn

    /** Phát prefab VFX tại vị trí, tự huỷ sau `lifetime` giây. Bỏ qua khi đã chạm prefabBudget. */
    public static prefab(prefab: Prefab, pos: Vec3, scale: number = 1, lifetime: number = 2, follow: Node = null): Node {
        if (!prefab) return null;
        if (this._alivePrefabs >= this.prefabBudget) return null;
        const node = instantiate(prefab);
        // AutoDestruction hẹn giờ trong onEnable nên phải cài trước khi node vào scene.
        // Bản sao này do ta tạo (không lấy từ pool) nên luôn huỷ hẳn, kể cả khi prefab để chế độ tắt/trả pool.
        const cleaner = node.getComponent(AutoDestruction) || node.addComponent(AutoDestruction);
        if (!cleaner.isArmed) cleaner.timeDeactive = lifetime;
        cleaner.mode = AutoDestructionMode.Destroy;
        const parent = follow && follow.isValid ? follow : this.resolveRoot();
        node.setParent(parent);
        if (follow && follow.isValid) node.setPosition(Vec3.ZERO);
        else node.setWorldPosition(pos);
        if (scale !== 1) node.setScale(scale, scale, scale);
        node.active = true;

        this._alivePrefabs += 1;
        let counted = true;
        const release = () => {
            if (!counted) return;
            counted = false;
            this._alivePrefabs = Math.max(0, this._alivePrefabs - 1);
        };
        node.once(Node.EventType.NODE_DESTROYED, release);
        // Dự phòng khi prefab tự tắt thay vì huỷ.
        setTimeout(release, (lifetime + 0.5) * 1000);
        return node;
    }

    /** Đổi scene thì bộ đếm phải về 0 (node cũ huỷ hết). */
    public static reset() {
        this._alivePrefabs = 0;
    }

    // ------------------------------------------------------------------ nội bộ

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
            // Bù scale của node cha để bán kính tính theo mét thế giới.
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
                if (node.isValid) node.destroy();
            })
            .start();
    }

    private static setColor(mat: Material, color: Color, a: number) {
        if (!mat) return;
        // Blend add (src_alpha, one): giảm cả màu lẫn alpha = mờ đi.
        const k = Math.max(0, Math.min(1, a));
        _c.set(color.r * k, color.g * k, color.b * k, color.a * k);
        mat.setProperty('mainColor', _c);
    }

    private static ease(name: FxEasing): (k: number) => number {
        return (easing as any)[name] || easing.quadOut;
    }

    private static resolveRoot(): Node {
        if (this.root && this.root.isValid) return this.root;
        return director.getScene() as unknown as Node;
    }

    // ------------------------------------------------------------------ mesh (tự dựng vì module primitive bị cắt khỏi build)

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

    /**
     * Cung tròn (mặt XZ, tâm ở gốc, bán kính ngoài 1). Mép trước (góc dương) sáng nhất, đuôi tắt dần;
     * mép ngoài sáng, mép trong mờ -> nhìn như vệt chém.
     */
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
            // Mép trong (mờ) rồi mép ngoài (sáng). Mép ngoài phình nhẹ ở giữa cung.
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

    /** N vệt nhọn toả từ tâm (mặt XZ, dài tối đa 1). spikeTip: ngọn sáng (gai); ngược lại gốc sáng (vết nứt). */
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
            // 2 điểm gốc + ngọn.
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
