import {
    _decorator,
    Component,
    Node,
    Prefab,
    instantiate,
    Vec2,
    Vec3,
    Camera,
    UITransform,
    CCBoolean,
    ParticleSystem,
    input,
    Input,
    EventTouch,
    EventMouse,
    tween,
    Tween,
} from 'cc';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('LCHPropObstacle')
export class LCHPropObstacle extends Component {
    public static activeObstacles: LCHPropObstacle[] = [];

    @property({ type: CCBoolean, tooltip: 'Tick = Bình Vase có thể phá hủy; Bỏ tick = Cột đá chỉ làm vật cản' })
    public isBreakableVase: boolean = false;

    @property({ tooltip: 'Tọa độ tâm vật cản trên mặt sàn (World XZ)' })
    public centerXZ: Vec3 = new Vec3();

    @property({ tooltip: 'Bán kính cản (Half Extents X, Z) trên mặt sàn' })
    public halfExtentsXZ: Vec3 = new Vec3(0.4, 0, 0.4);

    @property({ type: Prefab, tooltip: 'Hiệu ứng mảnh vỡ bắn tung (FX_common_impact_bone.prefab)' })
    public breakBonePrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói bụi khi bình vỡ (FX_Smoke_Die.prefab)' })
    public breakSmokePrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa VFX (System/Pool)' })
    public vfxContainer: Node = null;

    @property({ type: Camera, tooltip: 'Main Camera 3D để bắt chạm màn hình' })
    public worldCamera: Camera = null;

    @property({ type: Node, tooltip: 'Node UI Canvas' })
    public uiCanvasNode: Node = null;

    @property({ type: UITransform, tooltip: 'UITransform của UI Canvas' })
    public uiCanvasTransform: UITransform = null;

    public isBroken: boolean = false;

    private _worldLookPos: Vec3 = new Vec3();
    private _vaseUiPos: Vec3 = new Vec3();
    private _touchUiPos: Vec3 = new Vec3();

    protected onEnable(): void {
        if (!this.isBroken && LCHPropObstacle.activeObstacles.indexOf(this) === -1) {
            LCHPropObstacle.activeObstacles.push(this);
        }
        if (this.isBreakableVase) {
            input.on(Input.EventType.TOUCH_START, this.onScreenTouch, this);
            input.on(Input.EventType.MOUSE_DOWN, this.onScreenMouse, this);
        }
    }

    protected onDisable(): void {
        const idx = LCHPropObstacle.activeObstacles.indexOf(this);
        if (idx !== -1) {
            LCHPropObstacle.activeObstacles.splice(idx, 1);
        }
        if (this.isBreakableVase) {
            input.off(Input.EventType.TOUCH_START, this.onScreenTouch, this);
            input.off(Input.EventType.MOUSE_DOWN, this.onScreenMouse, this);
        }
    }

    private onScreenTouch(event: EventTouch): void {
        if (!this.isBreakableVase || this.isBroken || !this.node.activeInHierarchy) return;
        this.checkTapBreak(event.getUILocation());
    }

    private onScreenMouse(event: EventMouse): void {
        if (!this.isBreakableVase || this.isBroken || !this.node.activeInHierarchy) return;
        this.checkTapBreak(event.getUILocation());
    }

    private checkTapBreak(uiLoc: Vec2): void {
        if (!this.worldCamera || !this.uiCanvasNode || !this.uiCanvasTransform) return;

        // Chỉ cho phép nhấn phá bình khi bình đang nằm trong tầm nhìn phía trước Camera
        const camPos = this.worldCamera.node.worldPosition;
        const fwd = this.worldCamera.node.forward;
        const dxCam = this.centerXZ.x - camPos.x;
        const dyCam = 0.4 - camPos.y;
        const dzCam = this.centerXZ.z - camPos.z;
        if (dxCam * fwd.x + dyCam * fwd.y + dzCam * fwd.z <= 0.5) return;

        this._worldLookPos.set(this.centerXZ.x, 0.45, this.centerXZ.z);
        this.worldCamera.convertToUINode(this._worldLookPos, this.uiCanvasNode, this._vaseUiPos);
        this.uiCanvasTransform.convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0), this._touchUiPos);

        const dx = this._touchUiPos.x - this._vaseUiPos.x;
        const dy = this._touchUiPos.y - this._vaseUiPos.y;
        const tapRadius = this.halfExtentsXZ.x > 0.55 ? 125 : 95;

        if (dx * dx + dy * dy <= tapRadius * tapRadius) {
            this.breakVase();
        }
    }

    public breakVase(): void {
        if (!this.isBreakableVase || this.isBroken) return;
        this.isBroken = true;

        const idx = LCHPropObstacle.activeObstacles.indexOf(this);
        if (idx !== -1) {
            LCHPropObstacle.activeObstacles.splice(idx, 1);
        }

        const vfxScale = this.halfExtentsXZ.x > 0.55 ? 1.45 : 0.95;
        this.spawnBreakVfx(this.breakBonePrefab, vfxScale, 0.7);
        this.spawnBreakVfx(this.breakSmokePrefab, vfxScale * 0.9, 1.1);

        if (AudioManager.instance) {
            AudioManager.instance.playEnemyHit();
        }

        const baseScale = this.node.scale.clone();
        Tween.stopAllByTarget(this.node);
        tween(this.node)
            .to(0.06, { scale: new Vec3(baseScale.x * 1.28, baseScale.y * 0.65, baseScale.z * 1.28) }, { easing: 'quadOut' })
            .to(0.08, { scale: new Vec3(0.02, 0.02, 0.02) }, { easing: 'quadIn' })
            .call(() => {
                if (this.node && this.node.isValid) {
                    this.node.active = false;
                }
            })
            .start();
    }

    private spawnBreakVfx(prefab: Prefab, scale: number, life: number): void {
        if (!prefab || !this.vfxContainer) return;
        const fx = instantiate(prefab);
        fx.setParent(this.vfxContainer);
        fx.setWorldPosition(this.centerXZ.x, 0.35, this.centerXZ.z);
        fx.setScale(scale, scale, scale);
        fx.active = true;
        const ps = fx.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < ps.length; i++) {
            ps[i].clear();
            ps[i].play();
        }
        this.scheduleOnce(() => {
            if (fx && fx.isValid) fx.destroy();
        }, life);
    }

    /**
     * Đẩy vị trí nhân vật / quái ra ngoài vật cản (Vase chưa vỡ & Cột đá)
     */
    public static resolveActorPosition(pos: Vec3, actorRadius: number = 0.32): void {
        const list = LCHPropObstacle.activeObstacles;
        for (let i = 0; i < list.length; i++) {
            const obs = list[i];
            if (!obs || obs.isBroken || !obs.node || !obs.node.activeInHierarchy) continue;

            const rx = obs.halfExtentsXZ.x + actorRadius;
            const rz = obs.halfExtentsXZ.z + actorRadius;
            const dx = pos.x - obs.centerXZ.x;
            const dz = pos.z - obs.centerXZ.z;

            if (Math.abs(dx) < rx && Math.abs(dz) < rz) {
                const overlapX = rx - Math.abs(dx);
                const overlapZ = rz - Math.abs(dz);
                if (overlapX < overlapZ) {
                    pos.x += dx >= 0 ? overlapX : -overlapX;
                } else {
                    pos.z += dz >= 0 ? overlapZ : -overlapZ;
                }
            }
        }
    }

    /**
     * Kiểm tra các bình Vase nằm trong vùng vung vũ khí của Warrior khi đang đánh quái
     */
    public static breakVasesInSwingArc(origin: Vec3, facing: Vec3, swingRange: number, halfArcCos: number): void {
        const list = LCHPropObstacle.activeObstacles;
        for (let i = list.length - 1; i >= 0; i--) {
            const obs = list[i];
            if (!obs || !obs.isBreakableVase || obs.isBroken || !obs.node || !obs.node.activeInHierarchy) continue;

            const dx = obs.centerXZ.x - origin.x;
            const dz = obs.centerXZ.z - origin.z;
            const effectiveRange = swingRange + obs.halfExtentsXZ.x;
            const distSq = dx * dx + dz * dz;
            if (distSq > effectiveRange * effectiveRange) continue;

            if (distSq <= 1.15 * 1.15) {
                obs.breakVase();
                continue;
            }

            const invD = 1.0 / Math.max(0.001, Math.sqrt(distSq));
            const dot = (dx * invD) * facing.x + (dz * invD) * facing.z;
            if (dot >= halfArcCos) {
                obs.breakVase();
            }
        }
    }
}
