import {
    _decorator,
    Component,
    Node,
    Prefab,
    instantiate,
    Vec2,
    Vec3,
    Quat,
    Color,
    Camera,
    UITransform,
    CCInteger,
    CCBoolean,
    ParticleSystem,
    input,
    Input,
    EventTouch,
    EventMouse,
    tween,
    Tween,
} from 'cc';
import { LCHConfig } from './LCHConfig';
import { PaladinGroundFx } from '../VFX/PaladinGroundFx';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('LCHChest')
export class LCHChest extends Component {
    @property({ type: CCInteger, tooltip: 'Chỉ số hòm: 0 = Chest0 (Phòng 1), 1 = Chest1 (Phòng 2), 2 = Chest2 (Phòng 3)' })
    public chestIndex: number = 0;

    @property({ type: CCBoolean, tooltip: 'Tick nếu là Rương bẫy Phòng 3 (nằm sẵn trên sàn và thụt xuống đất khi chạm)' })
    public isTrapChest: boolean = false;

    @property({ type: Node, tooltip: 'Node nắp rương (UI_Chest_root/UI_Chest_lid)' })
    public lidNode: Node = null;

    @property({ type: Node, tooltip: 'Node Character_Warrior để đo khoảng cách lại gần' })
    public heroNode: Node = null;

    @property({ type: Camera, tooltip: 'Main Camera 3D để chiếu vị trí rương lên màn hình UI' })
    public worldCamera: Camera = null;

    @property({ type: Node, tooltip: 'Node gốc UI Canvas (Node UI)' })
    public uiCanvasNode: Node = null;

    @property({ type: UITransform, tooltip: 'UITransform của Node UI Canvas' })
    public uiCanvasTransform: UITransform = null;

    @property({ type: Node, tooltip: 'Node bàn tay chỉ vào rương (UI/ChestTapGuide)' })
    public tapGuideNode: Node = null;

    @property({ type: Prefab, tooltip: 'Khói bụi khi rương rơi chạm đất hoặc thụt xuống (FX_Smoke_Step.prefab)' })
    public dropSmokePrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa VFX (System/Pool)' })
    public vfxContainer: Node = null;

    @property({ type: LCHConfig, tooltip: 'File cấu hình LCHConfig (System/Config)' })
    public config: LCHConfig = null;

    public onChestUpgradeNowCallback: ((chest: LCHChest) => void) | null = null;
    public onChestTriggeredCallback: ((chest: LCHChest, remainingAudioDur: number) => void) | null = null;

    private _initialWorldPos: Vec3 = new Vec3();
    private _hasSavedPos: boolean = false;
    private _isReadyToInteract: boolean = false;
    private _isHeroNear: boolean = false;
    private _isTriggered: boolean = false;

    private _myPos: Vec3 = new Vec3();
    private _heroPos: Vec3 = new Vec3();
    private _worldLookPos: Vec3 = new Vec3();
    private _chestUiPos: Vec3 = new Vec3();
    private _touchUiPos: Vec3 = new Vec3();

    protected onLoad(): void {
        this.saveInitialTransform();
        input.on(Input.EventType.TOUCH_START, this.onScreenTouchStart, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onScreenMouseDown, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onScreenTouchStart, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onScreenMouseDown, this);
    }

    public saveInitialTransform(): void {
        if (!this._hasSavedPos) {
            this.node.getWorldPosition(this._initialWorldPos);
            this._hasSavedPos = true;
        }
    }

    public setupInitialState(): void {
        this.saveInitialTransform();
        this._isReadyToInteract = false;
        this._isHeroNear = false;
        this._isTriggered = false;

        if (this.lidNode) {
            this.lidNode.setRotationFromEuler(0, 0, 0);
        }

        if (this.isTrapChest) {
            // Chest2 ở Phòng 3 có sẵn ngay từ đầu tại vị trí (0, 0, -40), scale (3, 3, 3)
            this.node.active = true;
            this.node.setWorldPosition(this._initialWorldPos);
        } else {
            // Chest0 và Chest1 ẩn cho tới khi diệt hết quái trong phòng
            this.node.active = false;
        }
    }

    /**
     * Rơi rương từ trần xuống khi diệt hết quái (dành cho Chest0 Phòng 1 và Chest1 Phòng 2)
     */
    public dropFromCeiling(onLanded?: () => void): void {
        this.saveInitialTransform();
        Tween.stopAllByTarget(this.node);

        const cfg = this.config || LCHConfig.instance;
        const dropH = cfg ? cfg.dropHeight : 6.5;
        const dropDur = cfg ? cfg.dropDuration : 0.45;

        const startPos = new Vec3(this._initialWorldPos.x, dropH, this._initialWorldPos.z);
        const landPos = new Vec3(this._initialWorldPos.x, 0, this._initialWorldPos.z);

        this._isReadyToInteract = false;
        this._isTriggered = false;
        this._isHeroNear = false;
        if (this.lidNode) {
            this.lidNode.setRotationFromEuler(0, 0, 0);
        }

        this.node.active = true;
        this.node.setWorldPosition(startPos);

        tween(this.node)
            .to(dropDur, { worldPosition: landPos }, { easing: 'bounceOut' })
            .call(() => {
                this.node.setWorldPosition(landPos);
                this.spawnDustSmoke(landPos, 1.35);
                PaladinGroundFx.ring(landPos, {
                    from: 0.3,
                    to: 2.2,
                    duration: 0.45,
                    color: new Color(255, 215, 80, 255),
                    easing: 'quadOut',
                });
                this._isReadyToInteract = true;
                if (onLanded) onLanded();
            })
            .start();
    }

    public enableInteraction(): void {
        this._isReadyToInteract = true;
        this._isTriggered = false;
    }

    protected update(dt: number): void {
        if (!this._isReadyToInteract || this._isTriggered || !this.node.active) return;
        if (!this.heroNode || !this.heroNode.isValid) return;

        this.node.getWorldPosition(this._myPos);
        this.heroNode.getWorldPosition(this._heroPos);

        const dx = this._heroPos.x - this._myPos.x;
        const dz = this._heroPos.z - this._myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const cfg = this.config || LCHConfig.instance;
        const interactRadius = this.isTrapChest
            ? (cfg ? cfg.chest3InteractRadius : 4.2)
            : (cfg ? cfg.chestInteractRadius : 2.6);

        if (dist <= interactRadius) {
            this._isHeroNear = true;
            this.updateChestTapGuidePosition();
        } else {
            if (this._isHeroNear) {
                this._isHeroNear = false;
                if (this.tapGuideNode) {
                    this.tapGuideNode.active = false;
                }
            }
        }
    }

    private updateChestTapGuidePosition(): void {
        if (!this.worldCamera || !this.uiCanvasNode) return;

        const scaleY = this.node.scale.y;
        this._worldLookPos.set(this._myPos.x, this._myPos.y + 0.55 * scaleY, this._myPos.z);
        this.worldCamera.convertToUINode(this._worldLookPos, this.uiCanvasNode, this._chestUiPos);

        if (this.tapGuideNode) {
            if (!this.tapGuideNode.active) {
                this.tapGuideNode.active = true;
            }
            this.tapGuideNode.setPosition(this._chestUiPos.x, this._chestUiPos.y, 0);
        }
    }

    private onScreenTouchStart(event: EventTouch): void {
        if (!this._isReadyToInteract || this._isTriggered || !this._isHeroNear) return;
        const uiLoc = event.getUILocation();
        this.checkTapAtUILocation(uiLoc);
    }

    private onScreenMouseDown(event: EventMouse): void {
        if (!this._isReadyToInteract || this._isTriggered || !this._isHeroNear) return;
        const uiLoc = event.getUILocation();
        this.checkTapAtUILocation(uiLoc);
    }

    private checkTapAtUILocation(uiLoc: Vec2): void {
        if (!this.uiCanvasTransform) return;

        this.updateChestTapGuidePosition();
        this.uiCanvasTransform.convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0), this._touchUiPos);

        const dx = this._touchUiPos.x - this._chestUiPos.x;
        const dy = this._touchUiPos.y - this._chestUiPos.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);

        const cfg = this.config || LCHConfig.instance;
        const baseTapRadius = cfg ? cfg.chestScreenTapRadiusPx : 165;
        const tapRadius = this.isTrapChest ? baseTapRadius * 1.45 : baseTapRadius;

        if (distPx <= tapRadius) {
            this.triggerChest();
        }
    }

    private triggerChest(): void {
        if (this._isTriggered) return;
        this._isTriggered = true;
        this._isReadyToInteract = false;
        this._isHeroNear = false;

        if (this.tapGuideNode) {
            this.tapGuideNode.active = false;
        }

        this.node.getWorldPosition(this._myPos);

        if (!this.isTrapChest) {
            // Phát DUY NHẤT 1 lần âm thanh nâng cấp và nâng cấp vũ khí cho Warrior NGAY LÚC MỞ HÒM
            const audioLevel = this.chestIndex === 0 ? 1 : 2;
            const totalAudioDur = AudioManager.instance
                ? AudioManager.instance.playLevelUp(audioLevel)
                : 2.45;

            if (this.onChestUpgradeNowCallback) {
                this.onChestUpgradeNowCallback(this);
            }

            const chestOpenDur = Math.min(1.0, Math.max(0.72, totalAudioDur * 0.4));
            const prepDur = chestOpenDur * 0.42;
            const lidDur = chestOpenDur - prepDur;
            const remainingPopupDur = Math.max(1.15, totalAudioDur - chestOpenDur);

            const baseScale = this.node.scale.clone();
            Tween.stopAllByTarget(this.node);
            tween(this.node)
                .to(prepDur * 0.5, { scale: new Vec3(baseScale.x * 1.14, baseScale.y * 0.84, baseScale.z * 1.14) }, { easing: 'quadOut' })
                .to(prepDur * 0.5, { scale: new Vec3(baseScale.x * 0.94, baseScale.y * 1.12, baseScale.z * 0.94) }, { easing: 'quadIn' })
                .call(() => {
                    PaladinGroundFx.ring(this._myPos, {
                        from: 0.4,
                        to: 2.6,
                        duration: lidDur,
                        color: new Color(255, 220, 90, 255),
                        easing: 'cubicOut',
                    });
                })
                .to(lidDur * 0.6, { scale: baseScale }, { easing: 'backOut' })
                .start();

            if (this.lidNode) {
                Tween.stopAllByTarget(this.lidNode);
                const openRot = new Quat();
                Quat.fromEuler(openRot, -110, 0, 0);
                tween(this.lidNode)
                    .delay(prepDur)
                    .to(lidDur, { rotation: openRot }, { easing: 'backOut' })
                    .call(() => {
                        if (this.onChestTriggeredCallback) {
                            this.onChestTriggeredCallback(this, remainingPopupDur);
                        }
                    })
                    .start();
            } else {
                this.scheduleOnce(() => {
                    if (this.onChestTriggeredCallback) {
                        this.onChestTriggeredCallback(this, remainingPopupDur);
                    }
                }, chestOpenDur);
            }
        } else {
            if (AudioManager.instance) {
                AudioManager.instance.playSkillSelect();
            }
            // Chest2 (Phòng 3): Rương thụt thẳng xuống sàn biến mất + kích hoạt bẫy cửa cuối!
            this.spawnDustSmoke(this._myPos, 2.2);
            const sinkTarget = new Vec3(this._myPos.x, -4.0, this._myPos.z);
            Tween.stopAllByTarget(this.node);
            tween(this.node)
                .to(0.55, { worldPosition: sinkTarget }, { easing: 'backIn' })
                .call(() => {
                    this.node.active = false;
                })
                .start();

            if (this.onChestTriggeredCallback) {
                this.onChestTriggeredCallback(this, 0);
            }
        }
    }

    private spawnDustSmoke(pos: Vec3, scale: number): void {
        if (!this.dropSmokePrefab || !this.vfxContainer) return;
        const smoke = instantiate(this.dropSmokePrefab);
        smoke.setParent(this.vfxContainer);
        smoke.setWorldPosition(pos.x, 0.08, pos.z);
        smoke.setScale(scale, scale, scale);
        smoke.active = true;
        const ps = smoke.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < ps.length; i++) {
            ps[i].clear();
            ps[i].play();
        }
        this.scheduleOnce(() => {
            if (smoke && smoke.isValid) smoke.destroy();
        }, 1.0);
    }
}
