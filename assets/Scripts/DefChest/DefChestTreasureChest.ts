import { _decorator, Component, Node, Prefab, director } from 'cc';
import { EventManager } from '../System/EventManager';
import {
    DEFCHEST_EVENT_CHEST_EMPTY,
    DEFCHEST_EVENT_TREASURE_CHANGED,
} from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { BarAttacher, BarAttacherMode } from '../UI/BarAttacher';
import { DefChestChestVfx } from './DefChestChestVfx';

const { ccclass, property } = _decorator;

export { DEFCHEST_EVENT_TREASURE_CHANGED, DEFCHEST_EVENT_CHEST_EMPTY };

interface StealerEntry {
    id: number;
    enemyNode: Node;
    ratePerSec: number;
    coinTimer: number;
}

/**
 * DefChestTreasureChest — Quản lý trạng thái kho báu, danh sách quái đang cướp & thanh tiến trình Rương.
 * Phần hiệu ứng hình ảnh/vàng rơi được tách riêng sang `DefChestChestVfx`.
 */
@ccclass('DefChestTreasureChest')
export class DefChestTreasureChest extends Component {
    public static instance: DefChestTreasureChest | null = null;

    @property({ type: BarAttacher, tooltip: 'Component thanh tiến trình EnemyHpBar trên rương' })
    public barAttacher: BarAttacher = null;

    @property({ type: DefChestChestVfx, tooltip: 'Component hiệu ứng mở rương / vỡ rương / phun 20 vàng' })
    public chestVfx: DefChestChestVfx = null;

    // Giữ các @property tương thích trực tiếp trên Inspector của BaseClearChest
    @property({ type: Node, tooltip: 'Node Visual gốc bên trong BaseClearChest' })
    public visualNode: Node = null;

    @property({ type: Node, tooltip: 'Node thân rương (Visual/UI_Chest/UI_Chest_Box)' })
    public chestBoxNode: Node = null;

    @property({ type: Node, tooltip: 'Node nắp rương (Visual/UI_Chest/UI_Chest_lid)' })
    public chestLidNode: Node = null;

    @property({ type: Prefab, tooltip: 'Prefab Thỏi Vàng (GoldBar.prefab)' })
    public goldBarPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Prefab Đồng Xu Vàng (Collectible_Coin.prefab)' })
    public coinPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng ánh sáng vàng (FX_Claim_Gold.prefab)' })
    public fxClaimGoldPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng cột sáng (FX_LevelUp.prefab)' })
    public fxLevelUpPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói nổ khi rương vỡ (FX_Smoke_Die.prefab)' })
    public fxSmokeDiePrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng mảnh vỡ (FX_common_impact_bone.prefab)' })
    public fxBreakDebrisPrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa Vàng & VFX (System/Pool)' })
    public poolContainer: Node = null;

    public maxTreasure: number = 100.0;
    public currentTreasure: number = 100.0;
    public isEnded: boolean = false;

    private _stealers: Map<number, StealerEntry> = new Map();
    private _toRemoveIds: number[] = [];

    /**
     * Đảm bảo luôn lấy được DefChestTreasureChest kể cả khi gọi sớm ở frame đầu tiên
     */
    public static getOrResolve(): DefChestTreasureChest | null {
        if (this.instance && this.instance.isValid) {
            return this.instance;
        }
        const scene = director.getScene();
        if (!scene) return null;
        const chestNode = scene.getChildByPath('Map/BaseClearChest');
        if (!chestNode) return null;
        const comp = chestNode.getComponent(DefChestTreasureChest)
            || chestNode.addComponent(DefChestTreasureChest);
        this.instance = comp;
        return comp;
    }

    protected onLoad(): void {
        DefChestTreasureChest.instance = this;
        this.syncComponents();
    }

    protected start(): void {
        this.syncComponents();
        const cfg = DefChestConfig.instance;
        this.maxTreasure = cfg ? cfg.maxTreasure : 100.0;
        this.currentTreasure = this.maxTreasure;
        this.isEnded = false;

        if (this.barAttacher) {
            this.barAttacher.manualMode = BarAttacherMode.CHEST_PROGRESS;
            this.barAttacher.offset3D.set(0, 1.95, 0);
            this.barAttacher.barScale = 0.012;
            this.barAttacher.setRatio(1.0);
        }

        EventManager.instance.emit(DEFCHEST_EVENT_TREASURE_CHANGED, this.currentTreasure, this.maxTreasure, false);
    }

    protected onDestroy(): void {
        if (DefChestTreasureChest.instance === this) {
            DefChestTreasureChest.instance = null;
        }
    }

    private syncComponents(): void {
        if (!this.barAttacher) {
            this.barAttacher = this.getComponent(BarAttacher)
                || this.addComponent(BarAttacher);
            this.barAttacher.manualMode = BarAttacherMode.CHEST_PROGRESS;
        }
        if (!this.chestVfx) {
            this.chestVfx = this.getComponent(DefChestChestVfx)
                || this.addComponent(DefChestChestVfx);
        }
        if (this.chestVfx) {
            if (this.visualNode) this.chestVfx.visualNode = this.visualNode;
            if (this.chestBoxNode) this.chestVfx.chestBoxNode = this.chestBoxNode;
            if (this.chestLidNode) this.chestVfx.chestLidNode = this.chestLidNode;
            if (this.goldBarPrefab) this.chestVfx.goldBarPrefab = this.goldBarPrefab;
            if (this.coinPrefab) this.chestVfx.coinPrefab = this.coinPrefab;
            if (this.fxClaimGoldPrefab) this.chestVfx.fxClaimGoldPrefab = this.fxClaimGoldPrefab;
            if (this.fxLevelUpPrefab) this.chestVfx.fxLevelUpPrefab = this.fxLevelUpPrefab;
            if (this.fxSmokeDiePrefab) this.chestVfx.fxSmokeDiePrefab = this.fxSmokeDiePrefab;
            if (this.fxBreakDebrisPrefab) this.chestVfx.fxBreakDebrisPrefab = this.fxBreakDebrisPrefab;
            if (this.poolContainer) this.chestVfx.poolContainer = this.poolContainer;
            this.chestVfx.resolveNodes();
        }
    }

    public get treasureRatio(): number {
        return this.maxTreasure > 0 ? Math.max(0, Math.min(1.0, this.currentTreasure / this.maxTreasure)) : 0;
    }

    public registerStealer(enemyId: number, enemyNode: Node, ratePerSec: number): void {
        if (this.isEnded) return;
        const existing = this._stealers.get(enemyId);
        if (existing) {
            existing.ratePerSec = ratePerSec;
            existing.enemyNode = enemyNode;
        } else {
            this._stealers.set(enemyId, {
                id: enemyId,
                enemyNode,
                ratePerSec,
                coinTimer: 0.25,
            });
        }
    }

    public unregisterStealer(enemyId: number): void {
        if (this._stealers.has(enemyId)) {
            this._stealers.delete(enemyId);
            if (this._stealers.size === 0 && !this.isEnded) {
                this.chestVfx?.resetChestPose();
                EventManager.instance.emit(DEFCHEST_EVENT_TREASURE_CHANGED, this.currentTreasure, this.maxTreasure, false);
            }
        }
    }

    public applyEliteSkillBurstDrain(amount: number, attackerNode?: Node): void {
        if (this.isEnded || this.currentTreasure <= 0) return;
        this.currentTreasure = Math.max(0, this.currentTreasure - amount);
        this.barAttacher?.setRatio(this.treasureRatio);

        if (attackerNode && attackerNode.isValid && this.chestVfx) {
            for (let i = 0; i < 3; i++) {
                this.chestVfx.spawnStealCoinToEnemy(attackerNode);
            }
        }

        EventManager.instance.emit(DEFCHEST_EVENT_TREASURE_CHANGED, this.currentTreasure, this.maxTreasure, true);
        if (this.currentTreasure <= 0) {
            this.onTreasureDepleted();
        }
    }

    protected update(dt: number): void {
        if (this.isEnded || this._stealers.size === 0) return;

        let totalDrain = 0;
        const toRemove = this._toRemoveIds;
        toRemove.length = 0;

        this._stealers.forEach((entry, key) => {
            if (!entry.enemyNode || !entry.enemyNode.isValid || !entry.enemyNode.active) {
                toRemove.push(key);
                return;
            }
            totalDrain += entry.ratePerSec * dt;
            entry.coinTimer += dt;
            if (entry.coinTimer >= 0.38) {
                entry.coinTimer = 0;
                this.chestVfx?.spawnStealCoinToEnemy(entry.enemyNode);
            }
        });

        for (let i = 0; i < toRemove.length; i++) {
            this._stealers.delete(toRemove[i]);
        }

        if (this._stealers.size === 0) {
            this.chestVfx?.resetChestPose();
            return;
        }

        if (totalDrain > 0) {
            this.currentTreasure = Math.max(0, this.currentTreasure - totalDrain);
            this.barAttacher?.setRatio(this.treasureRatio);
            EventManager.instance.emit(DEFCHEST_EVENT_TREASURE_CHANGED, this.currentTreasure, this.maxTreasure, true);
        }

        this.chestVfx?.updateStealWobble(dt);

        if (this.currentTreasure <= 0) {
            this.onTreasureDepleted();
        }
    }

    private onTreasureDepleted(): void {
        if (this.isEnded) return;
        this.currentTreasure = 0;
        if (this.barAttacher) {
            this.barAttacher.setRatio(0);
            this.barAttacher.hideBar();
        }
        EventManager.instance.emit(DEFCHEST_EVENT_CHEST_EMPTY);
    }

    public playWinOpenAndGoldFountain(): void {
        if (this.isEnded) return;
        this.isEnded = true;
        this._stealers.clear();
        this.syncComponents();
        this.barAttacher?.hideBar();
        this.chestVfx?.playWinOpenAndGoldFountain();
    }

    public playLoseShatter(): void {
        if (this.isEnded) return;
        this.isEnded = true;
        this._stealers.clear();
        this.syncComponents();
        this.barAttacher?.hideBar();
        this.chestVfx?.playLoseShatter();
    }
}
