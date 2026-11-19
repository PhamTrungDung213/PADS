import { _decorator, Component, Node, Vec3, CCFloat, Camera, screen } from 'cc';
import { DefChestConfig } from './DefChestConfig';
import { DefChestHeroAgent } from './DefChestHeroAgent';

const { ccclass, property } = _decorator;

const RAD_TO_DEG = 180 / Math.PI;

/** Camera bám tâm đội hình 3 Hero và tự mở rộng FOV khi đội hình tách xa. */
@ccclass('DefChestCameraController')
export class DefChestCameraController extends Component {
    public static instance: DefChestCameraController | null = null;

    @property({ type: Node, tooltip: 'Node gốc đội hình (Character)' })
    public squadRootNode: Node = null;

    @property({ type: [Node], tooltip: 'Danh sách 3 Node nhân vật' })
    public heroNodes: Node[] = [];

    @property({ type: Camera, tooltip: 'Component Camera trên Main Camera' })
    public camComponent: Camera = null;

    @property({ type: CCFloat, tooltip: 'FOV cộng thêm ở màn hình dọc' })
    public portraitExtraFov: number = 0.0;

    private _initialCamPos: Vec3 = new Vec3();
    private _initialOffset: Vec3 = new Vec3();
    private _initialMaxPairDist: number = 2.2;
    private _centroid: Vec3 = new Vec3();
    private _desiredCamPos: Vec3 = new Vec3();
    private _currentCamPos: Vec3 = new Vec3();
    private _tmpA: Vec3 = new Vec3();
    private _tmpB: Vec3 = new Vec3();
    private _toHero: Vec3 = new Vec3();
    private _shakeOffset: Vec3 = new Vec3();

    private _heroAgents: (DefChestHeroAgent | null)[] = [];
    private _activeHeroesBuf: Node[] = [];
    private _isInitialized: boolean = false;
    private _isPortrait: boolean = true;
    private _shakeTimer: number = 0;
    private _shakeDuration: number = 0;
    private _shakeIntensity: number = 0.3;

    protected onLoad(): void {
        DefChestCameraController.instance = this;
        if (!this.camComponent) this.camComponent = this.getComponent(Camera);
    }

    protected start(): void {
        this.resolveTargets();
        this.captureInitialOffset();
    }

    protected onDestroy(): void {
        if (DefChestCameraController.instance === this) DefChestCameraController.instance = null;
    }

    private resolveTargets(): void {
        if (!this.squadRootNode && this.node.scene) {
            this.squadRootNode = this.node.scene.getChildByName('Character');
        }
        if ((!this.heroNodes || this.heroNodes.length === 0) && this.squadRootNode) {
            const p = this.squadRootNode.getChildByName('P_Paladin');
            const w = this.squadRootNode.getChildByName('Character_Warrior');
            const r = this.squadRootNode.getChildByName('Character_Ranger');
            this.heroNodes = [p, w, r].filter(Boolean) as Node[];
        }
        this._heroAgents.length = this.heroNodes.length;
        for (let i = 0; i < this.heroNodes.length; i++) {
            const h = this.heroNodes[i];
            this._heroAgents[i] = h && h.isValid ? h.getComponent(DefChestHeroAgent) : null;
        }
    }

    public captureInitialOffset(): void {
        if (this._heroAgents.length !== this.heroNodes.length) this.resolveTargets();
        this.node.getWorldPosition(this._initialCamPos);
        this.computeSquadCentroid(this._centroid);
        Vec3.subtract(this._initialOffset, this._initialCamPos, this._centroid);

        let maxD = 0;
        for (let i = 0; i < this.heroNodes.length; i++) {
            const ha = this.heroNodes[i];
            if (!ha || !ha.isValid) continue;
            ha.getWorldPosition(this._tmpA);
            for (let j = i + 1; j < this.heroNodes.length; j++) {
                const hb = this.heroNodes[j];
                if (!hb || !hb.isValid) continue;
                hb.getWorldPosition(this._tmpB);
                const d = Vec3.distance(this._tmpA, this._tmpB);
                if (d > maxD) maxD = d;
            }
        }
        if (maxD > 0.1) this._initialMaxPairDist = maxD;
        this._isInitialized = true;
    }

    public setOrientationMode(isPortrait: boolean): void {
        this._isPortrait = isPortrait;
    }

    public shake(duration: number = 0.28, intensity: number = 0.28): void {
        this._shakeDuration = Math.max(0.05, duration);
        this._shakeTimer = this._shakeDuration;
        this._shakeIntensity = intensity;
    }

    public computeSquadCentroid(out: Vec3): Vec3 {
        let sumX = 0, sumY = 0, sumZ = 0, count = 0;

        for (let i = 0; i < this.heroNodes.length; i++) {
            const h = this.heroNodes[i];
            if (!h || !h.isValid || !h.active) continue;
            const agent = this._heroAgents[i];
            if (agent && agent.isDead) continue;

            h.getWorldPosition(this._tmpA);
            sumX += this._tmpA.x;
            sumY += this._tmpA.y;
            sumZ += this._tmpA.z;
            count++;
        }

        if (count > 0) {
            out.set(sumX / count, sumY / count, sumZ / count);
            return out;
        }
        if (this.squadRootNode && this.squadRootNode.isValid) {
            this.squadRootNode.getWorldPosition(out);
            return out;
        }
        out.set(3.425, 0.32, -2.822);
        return out;
    }

    protected lateUpdate(dt: number): void {
        if (!this._isInitialized) this.captureInitialOffset();

        const cfg = DefChestConfig.instance;
        const followSpeed = cfg ? cfg.camFollowSpeed : 8.5;

        this.computeSquadCentroid(this._centroid);
        Vec3.add(this._desiredCamPos, this._centroid, this._initialOffset);

        this.node.getWorldPosition(this._currentCamPos);
        Vec3.lerp(this._currentCamPos, this._currentCamPos, this._desiredCamPos, Math.min(1.0, followSpeed * dt));

        if (this._shakeTimer > 0) {
            this._shakeTimer -= dt;
            const amp = this._shakeIntensity * Math.max(0, this._shakeTimer / this._shakeDuration);
            this._shakeOffset.set(
                (Math.random() * 2 - 1) * amp,
                (Math.random() * 2 - 1) * amp * 0.5,
                (Math.random() * 2 - 1) * amp
            );
            this._currentCamPos.add(this._shakeOffset);
        }

        this.node.setWorldPosition(this._currentCamPos);
        this.updateDynamicFov(dt);
    }

    private updateDynamicFov(dt: number): void {
        if (!this.camComponent) return;

        const cfg = DefChestConfig.instance;
        const baseFov = (cfg ? cfg.baseFov : 45.0) + (this._isPortrait ? this.portraitExtraFov : 0);
        const maxFov = cfg ? cfg.maxFov : 68.0;
        const spreadThreshold = Math.max(this._initialMaxPairDist + 0.55, cfg ? cfg.heroSpreadThreshold : 3.2);
        const expandGain = cfg ? cfg.fovExpandGain : 4.2;
        const fovSmooth = cfg ? cfg.fovSmoothSpeed : 6.0;

        this._activeHeroesBuf.length = 0;
        for (let i = 0; i < this.heroNodes.length; i++) {
            const h = this.heroNodes[i];
            if (!h || !h.isValid || !h.active) continue;
            const agent = this._heroAgents[i];
            if (agent && agent.isDead) continue;
            this._activeHeroesBuf.push(h);
        }

        const camPos = this.node.worldPosition;
        const camForward = this.node.forward;
        const camRight = this.node.right;
        const camUp = this.node.up;
        const winSize = screen.windowSize;
        const aspect = winSize.height > 0 ? winSize.width / winSize.height : (this._isPortrait ? 9 / 16 : 16 / 9);
        const safeAspect = Math.max(0.45, aspect);

        let maxPairDist = 0;
        let maxHalfVertDeg = 0;

        for (let i = 0; i < this._activeHeroesBuf.length; i++) {
            this._activeHeroesBuf[i].getWorldPosition(this._tmpA);

            Vec3.subtract(this._toHero, this._tmpA, camPos);
            const depth = Vec3.dot(this._toHero, camForward);
            if (depth > 1.0) {
                const localX = Math.abs(Vec3.dot(this._toHero, camRight));
                const localY = Math.abs(Vec3.dot(this._toHero, camUp));
                const reqTan = Math.max((localY / depth) * 1.25, (localX / (depth * safeAspect)) * 1.25);
                const reqDeg = Math.atan(reqTan) * RAD_TO_DEG;
                if (reqDeg > maxHalfVertDeg) maxHalfVertDeg = reqDeg;
            }

            for (let j = i + 1; j < this._activeHeroesBuf.length; j++) {
                this._activeHeroesBuf[j].getWorldPosition(this._tmpB);
                const d = Vec3.distance(this._tmpA, this._tmpB);
                if (d > maxPairDist) maxPairDist = d;
            }
        }

        let extraFov = maxPairDist > spreadThreshold ? (maxPairDist - spreadThreshold) * expandGain : 0;
        const frustumFov = maxHalfVertDeg * 2.0;
        if (frustumFov > baseFov && maxPairDist > this._initialMaxPairDist + 0.35) {
            extraFov = Math.max(extraFov, frustumFov - baseFov);
        }

        const targetFov = Math.max(baseFov, Math.min(maxFov, baseFov + extraFov));
        this.camComponent.fov += (targetFov - this.camComponent.fov) * Math.min(1.0, fovSmooth * dt);
    }
}
