import {
    _decorator,
    Component,
    Node,
    Camera,
    Vec3,
    Prefab,
    instantiate,
    CCFloat,
    director,
    Canvas,
    Sprite,
    SpriteFrame,
    Color,
    Enum,
    assetManager,
    js,
} from 'cc';
import { HPBar } from './HPBar';
import { ExpBar } from './ExpBar';
import { CharStats } from '../Char/CharStats';
import { GameManager } from '../System/GameManager';

const { ccclass, property } = _decorator;

export enum BarAttacherMode {
    AUTO_SURVIVAL = 0,   // Hành vi gốc mặc định cho Survival & LCH (tương thích ngược 100%)
    HERO_EXP_AS_HP = 1,  // 3 Nhân vật lấy ExpBar.prefab làm thanh HP
    ENEMY_HP = 2,        // Địch lấy EnemyHpBar.prefab (chỉ hiện khi 0 < ratio < 0.999)
    CHEST_PROGRESS = 3,  // Rương lấy EnemyHpBar.prefab tô vàng làm thanh tiến trình bị mở
}
Enum(BarAttacherMode);

const EXP_BAR_UUID = 'a34a358d-ab16-46cc-92b7-2d4b60eb20b4';
const ENEMY_HP_BAR_UUID = 'e91b47a2-6d05-4c38-b2fe-70a3195cd814';
const WHITE_FILL_UUID = '13f68e6b-0ac6-417b-990e-b74b3f8eb891@f9941';

/**
 * Quản lý thanh Bar 3D Billboard trên đầu mục tiêu:
 * - Chế độ mặc định (AUTO_SURVIVAL): Giữ nguyên hành vi Survival & LCH.
 * - Chế độ chủ động (HERO_EXP_AS_HP / ENEMY_HP / CHEST_PROGRESS): Điều khiển trực tiếp qua setRatio(ratio).
 */
@ccclass('BarAttacher')
export class BarAttacher extends Component {
    @property({ type: BarAttacherMode, tooltip: 'Chế độ hoạt động (0: Tự động Survival, 1: Hero ExpBar HP, 2: Địch HpBar, 3: Rương Tiến trình vàng)' })
    public manualMode: BarAttacherMode = BarAttacherMode.AUTO_SURVIVAL;

    @property({ type: Node, tooltip: '3D target node to attach health/exp bar' })
    public targetNode: Node = null;

    @property({ type: Camera, tooltip: '3D world camera' })
    public worldCamera: Camera = null;

    @property({ type: Prefab, tooltip: 'Enemy health bar prefab (EnemyHpBar.prefab / HpBar.prefab)' })
    public hpBarPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Player exp bar prefab (ExpBar.prefab)' })
    public expBarPrefab: Prefab = null;

    @property({ type: SpriteFrame, tooltip: 'Sprite trắng (BossHPBarWhite.png) để tô màu vàng cho thanh tiến trình Rương' })
    public chestWhiteFillSprite: SpriteFrame = null;

    @property({ tooltip: '3D offset above target head' })
    public offset3D: Vec3 = new Vec3(0, 1.35, 0);

    @property({ type: CCFloat, tooltip: '3D bar scale factor' })
    public barScale: number = 0.01;

    private _barNode: Node = null;
    private _hpBarComp: HPBar = null;
    private _expBarComp: ExpBar = null;
    private _enemyStats: any = null;
    private _isPlayer: boolean = false;
    private _tempPos: Vec3 = new Vec3();
    private _barWorldPos: Vec3 = new Vec3();
    private _prefabScale: Vec3 = new Vec3(1, 1, 1);
    private _manualRatio: number = 1.0;
    private _isLoadingFallback: boolean = false;

    onLoad() {
        if (this.manualMode !== BarAttacherMode.AUTO_SURVIVAL) {
            this.loadFallbackAssetsIfNeeded();
            return;
        }

        this.checkIsPlayer();

        if (!this._isPlayer) {
            // Đối với quái, targetNode LUÔN LUÔN chính là this.node
            this.targetNode = this.node;
            this._enemyStats = (this.node.getComponent('Enemy') as any)
                || (this.node.getComponent('EnemyStats') as any);
        } else {
            if (!this.targetNode) {
                this.targetNode = this.node;
            }
            this.resolveCamera();
            this.createBar();
        }
    }

    private checkIsPlayer(): boolean {
        const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
        if (!target) {
            this._isPlayer = false;
            return false;
        }

        if (target.getComponent(CharStats) || this.getComponent(CharStats)) {
            this._isPlayer = true;
            return true;
        }

        if (target.name === 'Character' || this.node.name === 'Character') {
            this._isPlayer = true;
            return true;
        }

        let curr: Node | null = target.parent;
        while (curr) {
            if (curr.name === 'Character' || curr.getComponent(CharStats)) {
                this._isPlayer = true;
                return true;
            }
            curr = curr.parent;
        }

        this._isPlayer = false;
        return false;
    }

    onDisable() {
        this.hideBar();
    }

    onDestroy() {
        if (this._barNode && this._barNode.isValid) {
            this._barNode.destroy();
            this._barNode = null;
        }
    }

    start() {
        if (this.manualMode !== BarAttacherMode.AUTO_SURVIVAL) {
            this.resolveCamera();
            this.ensureManualBarCreated();
            this.setRatio(this._manualRatio);
            return;
        }
        if (this._isPlayer) {
            this.resolveCamera();
            this.createBar();
        }
    }

    private loadFallbackAssetsIfNeeded(): void {
        if (this.manualMode === BarAttacherMode.HERO_EXP_AS_HP && !this.expBarPrefab && !this._isLoadingFallback) {
            this._isLoadingFallback = true;
            assetManager.loadAny(EXP_BAR_UUID, (err, pf: Prefab) => {
                this._isLoadingFallback = false;
                if (!err && pf && this.isValid) {
                    this.expBarPrefab = pf;
                    this.setRatio(this._manualRatio);
                }
            });
        } else if (
            (this.manualMode === BarAttacherMode.ENEMY_HP || this.manualMode === BarAttacherMode.CHEST_PROGRESS)
            && !this.hpBarPrefab
            && !this._isLoadingFallback
        ) {
            this._isLoadingFallback = true;
            assetManager.loadAny(ENEMY_HP_BAR_UUID, (err, pf: Prefab) => {
                this._isLoadingFallback = false;
                if (!err && pf && this.isValid) {
                    this.hpBarPrefab = pf;
                    this.setRatio(this._manualRatio);
                }
            });
        }

        if (!this.chestWhiteFillSprite && this.manualMode === BarAttacherMode.CHEST_PROGRESS) {
            assetManager.loadAny(WHITE_FILL_UUID, (err, sf: SpriteFrame) => {
                if (!err && sf && this.isValid) {
                    this.chestWhiteFillSprite = sf;
                    this.applyChestGoldStyle();
                }
            });
        }
    }

    private ensureManualBarCreated(): void {
        if (!this.isValid || !this.node || !this.node.isValid) return;
        if (this._barNode && this._barNode.isValid) return;

        const prefab = this.manualMode === BarAttacherMode.HERO_EXP_AS_HP
            ? this.expBarPrefab
            : this.hpBarPrefab;
        if (!prefab) {
            this.loadFallbackAssetsIfNeeded();
            return;
        }

        const sceneRoot: Node = director.getScene() as any;
        if (!sceneRoot) return;

        this._barNode = instantiate(prefab);
        if (this.manualMode === BarAttacherMode.HERO_EXP_AS_HP) {
            const expComp = this._barNode.getComponent(ExpBar);
            if (expComp) expComp.useAsHealthBar = true;
        }
        this._barNode.setParent(sceneRoot);

        const initScale = this._barNode.scale;
        this._prefabScale.set(
            initScale.x > 0 ? initScale.x : 1.0,
            initScale.y > 0 ? initScale.y : 0.35,
            initScale.z > 0 ? initScale.z : 1.0
        );

        this.applyBarScale();
        this.updatePosition();
        const cam = this.resolveCamera();
        if (cam && cam.node && cam.node.isValid) {
            this._barNode.setWorldRotation(cam.node.worldRotation);
        }

        if (this.manualMode === BarAttacherMode.HERO_EXP_AS_HP) {
            this._barNode.name = 'DefChest_HeroHP_' + this.node.name;
            this._expBarComp = this._barNode.getComponent(ExpBar) || this._barNode.addComponent(ExpBar);
            this._expBarComp.useAsHealthBar = true;
            this._expBarComp.setProgress(this._manualRatio);
            this._barNode.active = true;
        } else if (this.manualMode === BarAttacherMode.CHEST_PROGRESS) {
            this._barNode.name = 'DefChest_TreasureBar';
            this._hpBarComp = this._barNode.getComponent(HPBar) || this._barNode.addComponent(HPBar);
            this.applyChestGoldStyle();
            this._hpBarComp.setProgress(this._manualRatio);
            this._barNode.active = true;
        } else {
            this._barNode.name = 'DefChest_EnemyHP_' + this.node.name;
            this._hpBarComp = this._barNode.getComponent(HPBar) || this._barNode.addComponent(HPBar);
            this._hpBarComp.setProgress(this._manualRatio);
            this._barNode.active = false;
        }
    }

    private applyChestGoldStyle(): void {
        if (!this._barNode || !this._barNode.isValid || this.manualMode !== BarAttacherMode.CHEST_PROGRESS) return;
        const fillNode = this._barNode.getChildByName('Fill');
        const fillSp = fillNode ? fillNode.getComponent(Sprite) : null;
        if (fillSp) {
            if (this.chestWhiteFillSprite) {
                fillSp.spriteFrame = this.chestWhiteFillSprite;
            }
            fillSp.type = Sprite.Type.FILLED;
            fillSp.fillType = Sprite.FillType.HORIZONTAL;
            fillSp.color = new Color(255, 214, 45, 255);
        }
    }

    /**
     * Điều khiển trực tiếp tỉ lệ thanh Bar (0.0 -> 1.0) cho các chế độ chủ động (Hero HP / Địch HP / Tiến trình Rương).
     */
    public setRatio(ratio: number): void {
        this._manualRatio = Math.max(0, Math.min(1.0, ratio));
        if (!this.isValid || !this.node || !this.node.isValid) return;
        if (this.manualMode === BarAttacherMode.AUTO_SURVIVAL) {
            this.setHpRatio(this._manualRatio);
            return;
        }

        this.ensureManualBarCreated();
        if (!this._barNode || !this._barNode.isValid) return;

        if (this.manualMode === BarAttacherMode.HERO_EXP_AS_HP) {
            this._barNode.active = this._manualRatio > 0;
            if (this._expBarComp) {
                this._expBarComp.useAsHealthBar = true;
                this._expBarComp.setProgress(this._manualRatio);
            }
        } else if (this.manualMode === BarAttacherMode.CHEST_PROGRESS) {
            this._barNode.active = this._manualRatio > 0;
            this.applyChestGoldStyle();
            if (this._hpBarComp) {
                this._hpBarComp.setProgress(this._manualRatio);
            }
        } else {
            if (this._manualRatio < 0.999 && this._manualRatio > 0) {
                this._barNode.active = true;
                this.applyBarScale();
                if (this._hpBarComp) {
                    this._hpBarComp.setProgress(this._manualRatio);
                }
            } else {
                this._barNode.active = false;
            }
        }

        if (this._barNode.active) {
            this.updateManualTransform();
        }
    }

    private updateManualTransform(): void {
        this.updatePosition();
        const cam = this.resolveCamera();
        if (cam && cam.node && cam.node.isValid && this._barNode && this._barNode.isValid) {
            this._barNode.setWorldRotation(cam.node.worldRotation);
        }
    }

    private isUnderCanvas(node: Node): boolean {
        let curr: Node | null = node;
        while (curr) {
            if (curr.getComponent(Canvas)) return true;
            curr = curr.parent;
        }
        return false;
    }

    private resolveCamera(): Camera | null {
        if (this.worldCamera && this.worldCamera.isValid && this.worldCamera.node && this.worldCamera.node.isValid) {
            return this.worldCamera;
        }

        // Tìm 3D Camera trong scene (loại trừ UICamera dưới Canvas)
        const scene = director.getScene();
        if (scene) {
            const cameras = scene.getComponentsInChildren(Camera);
            for (let i = 0; i < cameras.length; i++) {
                const cam = cameras[i];
                if (cam && cam.node && cam.node.isValid && !this.isUnderCanvas(cam.node)) {
                    this.worldCamera = cam;
                    return cam;
                }
            }
        }
        return null;
    }

    public createBar() {
        if (!this.isValid || !this.node || !this.node.isValid) return;
        if (this._barNode && this._barNode.isValid) return;
        this.checkIsPlayer();

        const prefabToUse = this._isPlayer ? this.expBarPrefab : this.hpBarPrefab;
        if (!prefabToUse) return;

        // Cho vào root của scene để đảm bảo scale độc lập 1:1, không bị co giãn theo model
        let sceneRoot: Node = director.getScene() as any;

        this._barNode = instantiate(prefabToUse);
        this._barNode.setParent(sceneRoot);

        // Đọc scale chuẩn từ chính Prefab
        const initScale = this._barNode.scale;
        this._prefabScale.set(
            initScale.x > 0 ? initScale.x : 1.0,
            initScale.y > 0 ? initScale.y : (this._isPlayer ? 0.3 : 0.4),
            initScale.z > 0 ? initScale.z : 1.0
        );

        this.applyBarScale();
        this.updatePosition();

        const cam = this.resolveCamera();
        if (cam && cam.node && cam.node.isValid) {
            this._barNode.setWorldRotation(cam.node.worldRotation);
        }

        if (this._isPlayer) {
            this._barNode.active = true;
            this._barNode.name = 'Hero_ExpBar';
            this._expBarComp = this._barNode.getComponent(ExpBar) || this._barNode.addComponent(ExpBar);
            const gm = GameManager.instance;
            const initialRatio = gm && typeof (gm as any).getExpRatio === 'function' ? (gm as any).getExpRatio() : 0;
            if (this._expBarComp) {
                this._expBarComp.setProgress(initialRatio);
            }
        } else {
            // Quái: Mặc định ẩn hoàn toàn khi chưa bị đánh
            this._barNode.active = false;
            this._barNode.name = 'Enemy_HpBar_' + this.node.name;
            this._hpBarComp = this._barNode.getComponent(HPBar) || this._barNode.addComponent(HPBar);
        }
    }

    public setHpRatio(ratio: number) {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        if (this._isPlayer) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
            }
            if (this._barNode && this._barNode.isValid) {
                this._barNode.active = true;
                this.updatePosition();
            }
            if (this._expBarComp) {
                this._expBarComp.setProgress(ratio);
            }
            return;
        }

        // Đối với quái: chỉ hiện khi bị mất máu (ratio < 1.0) và còn sống (ratio > 0)
        if (ratio < 1.0 && ratio > 0) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
            }
            if (this._barNode && this._barNode.isValid) {
                this.applyBarScale();
                this._barNode.active = true;
                this.updatePosition();
                const cam = this.resolveCamera();
                if (cam && cam.node && cam.node.isValid) {
                    this._barNode.setWorldRotation(cam.node.worldRotation);
                }
                if (this._hpBarComp) {
                    this._hpBarComp.setProgress(ratio);
                }
            }
        } else {
            this.hideBar();
        }
    }

    public resetBar() {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        if (this._isPlayer) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
            }
            if (this._barNode && this._barNode.isValid) {
                this.applyBarScale();
                this._barNode.active = true;
                this.updatePosition();
            }
            if (this._expBarComp) {
                this._expBarComp.setProgress(0);
            }
        } else {
            this.hideBar();
        }
    }

    public hideBar() {
        if (this._barNode && this._barNode.isValid) {
            this._barNode.active = false;
        }
    }

    /**
     * Áp dụng scale chính xác: Scale gốc do bạn chỉnh trong Prefab (X, Y, Z) nhân với hệ số barScale
     */
    private applyBarScale() {
        if (!this._barNode || !this._barNode.isValid) return;
        this._barNode.setScale(
            this._prefabScale.x * this.barScale,
            this._prefabScale.y * this.barScale,
            this._prefabScale.z * this.barScale
        );
    }

    private updatePosition() {
        if (!this._barNode || !this._barNode.isValid) return;
        const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
        if (!target || !target.isValid) return;

        target.getWorldPosition(this._tempPos);
        this._barWorldPos.set(
            this._tempPos.x + this.offset3D.x,
            this._tempPos.y + this.offset3D.y,
            this._tempPos.z + this.offset3D.z
        );
        this._barNode.setWorldPosition(this._barWorldPos);
    }

    lateUpdate(deltaTime: number) {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        if (this.manualMode !== BarAttacherMode.AUTO_SURVIVAL) {
            if (this._barNode && this._barNode.isValid && this._barNode.active) {
                this.updateManualTransform();
            }
            return;
        }

        if (this._isPlayer) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
                if (!this._barNode || !this._barNode.isValid) return;
            }

            const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
            if (!target || !target.isValid || !target.activeInHierarchy) {
                this.hideBar();
                return;
            }

            this.updatePosition();
            const cam = this.resolveCamera();
            if (cam && cam.node && cam.node.isValid) {
                this._barNode.setWorldRotation(cam.node.worldRotation);
            }

            this._barNode.active = true;
            const gm = GameManager.instance;
            if (gm && this._expBarComp && typeof (gm as any).getExpRatio === 'function') {
                this._expBarComp.setProgress((gm as any).getExpRatio());
            }
        } else {
            // Đối với quái: Nếu không có thanh máu gán thì không cần tính toán vị trí, tiết kiệm CPU tối đa
            if (!this._barNode || !this._barNode.isValid || !this._barNode.active) {
                return;
            }

            const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
            if (!target || !target.isValid || !target.activeInHierarchy) {
                this.hideBar();
                return;
            }

            this.updatePosition();
            const cam = this.resolveCamera();
            if (cam && cam.node && cam.node.isValid) {
                this._barNode.setWorldRotation(cam.node.worldRotation);
            }

            if (!this._enemyStats) {
                this._enemyStats = (this.node.getComponent('Enemy') as any)
                    || (this.node.getComponent('EnemyStats') as any)
                    || (this.targetNode ? this.targetNode.getComponent('Enemy') as any : null);
            }

            if (this._enemyStats) {
                if (!this._enemyStats.isAlive || this._enemyStats.currentHp <= 0) {
                    this.hideBar();
                    return;
                }

                if (this._enemyStats.currentHp < this._enemyStats.maxHp) {
                    this._barNode.active = true;
                    if (this._hpBarComp && this._enemyStats.maxHp > 0) {
                        this._hpBarComp.setProgress(this._enemyStats.currentHp / this._enemyStats.maxHp);
                    }
                } else {
                    this.hideBar();
                }
            } else {
                this.hideBar();
            }
        }
    }
}

// Đăng ký alias đảm bảo tương thích ngược mọi tham chiếu cũ
js.setClassName('BarAttacher', BarAttacher);
js.setClassName('Test', BarAttacher);
