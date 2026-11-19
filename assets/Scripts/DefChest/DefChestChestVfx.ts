import {
    _decorator,
    Component,
    Node,
    Prefab,
    instantiate,
    Vec3,
    Quat,
    tween,
    Tween,
    js,
} from 'cc';
import { DefChestConfig } from './DefChestConfig';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

interface GoldPoolEntry {
    node: Node;
    isBar: boolean;
    flightTween: Tween<any> | null;
    bounceTween: Tween<any> | null;
}

/**
 * DefChestGoldPool — FIFO Ring Buffer Object Pool cho đúng 20 vật phẩm Vàng rơi từ Rương khi Thắng:
 * - Spawn lần lượt từng thỏi vàng / đồng xu (tối đa `maxCount = 20`).
 * - Khi quá `20` vàng xuất hiện, tự động dừng tween cũ và lấy cục vàng cũ nhất trong vòng lặp (FIFO)
 *   reset vị trí về miệng Rương để bắn phun ra tiếp liên tục cho đến khi tắt scene.
 */
export class DefChestGoldPool {
    private _goldBarPrefab: Prefab | null;
    private _coinPrefab: Prefab | null;
    private _container: Node;
    private _maxCount: number;
    private _ringNodes: GoldPoolEntry[] = [];
    private _cursor: number = 0;

    constructor(
        goldBarPrefab: Prefab | null,
        coinPrefab: Prefab | null,
        container: Node,
        maxCount: number = 20
    ) {
        this._goldBarPrefab = goldBarPrefab;
        this._coinPrefab = coinPrefab;
        this._container = container;
        this._maxCount = Math.max(1, maxCount);
    }

    public spawnOrRecycleGoldDrop(
        chestWorldPos: Vec3,
        groundY: number = 0.28,
        onLanded?: () => void
    ): Node | null {
        let entry: GoldPoolEntry | null = null;

        if (this._ringNodes.length < this._maxCount) {
            const index = this._ringNodes.length;
            const useBar = this._goldBarPrefab ? (index % 2 === 0 || !this._coinPrefab) : false;
            const prefab = useBar ? this._goldBarPrefab : (this._coinPrefab || this._goldBarPrefab);
            if (!prefab) return null;

            const newNode = instantiate(prefab);
            this.stripCollectibleScripts(newNode);
            if (this._container && this._container.isValid) {
                newNode.setParent(this._container);
            }
            entry = { node: newNode, isBar: useBar, flightTween: null, bounceTween: null };
            this._ringNodes.push(entry);
            this._cursor = this._ringNodes.length % this._maxCount;
        } else {
            entry = this._ringNodes[this._cursor];
            this._cursor = (this._cursor + 1) % this._maxCount;
            if (!entry || !entry.node || !entry.node.isValid) {
                return null;
            }
            if (entry.flightTween) {
                entry.flightTween.stop();
                entry.flightTween = null;
            }
            if (entry.bounceTween) {
                entry.bounceTween.stop();
                entry.bounceTween = null;
            }
        }

        const itemNode = entry.node;
        Tween.stopAllByTarget(itemNode);
        itemNode.active = true;

        // Phóng lên từ miệng rương đã mở (BaseClearChest scale x3 nên miệng rương cao ~1.35m)
        const startX = chestWorldPos.x + (Math.random() - 0.5) * 0.45;
        const startY = chestWorldPos.y + 1.35;
        const startZ = chestWorldPos.z + (Math.random() - 0.5) * 0.45;
        itemNode.setWorldPosition(startX, startY, startZ);

        // Kích thước nổi bật rõ trên nền cát (GoldBar mesh gốc nhỏ nên scale 2.45, Coin scale 1.35)
        const baseScale = entry.isBar ? 2.45 : 1.35;
        itemNode.setScale(baseScale * 0.4, baseScale * 0.4, baseScale * 0.4);

        // Bắn vòng cung cao rõ ràng và rơi ra ngoài thân rương x3 (bán kính 1.65m .. 3.8m)
        const angle = Math.random() * Math.PI * 2;
        const dist = 1.65 + Math.random() * 2.15;
        const landX = chestWorldPos.x + Math.cos(angle) * dist;
        const landZ = chestWorldPos.z + Math.sin(angle) * dist;
        const landY = groundY + (entry.isBar ? 0.10 : 0.08);
        const peakY = startY + 2.15 + Math.random() * 1.25;
        const duration = 0.56 + Math.random() * 0.16;

        const yawEnd = Math.random() * 360;
        const rollSpin = (Math.random() > 0.5 ? 1 : -1) * 420;
        const animState = { t: 0 };
        const tmpPos = new Vec3();
        const tmpRot = new Quat();
        const curEntry = entry;

        curEntry.flightTween = tween(animState)
            .to(duration, { t: 1 }, {
                onUpdate: () => {
                    if (!itemNode || !itemNode.isValid) return;
                    const u = animState.t;
                    tmpPos.x = startX + (landX - startX) * u;
                    tmpPos.z = startZ + (landZ - startZ) * u;
                    const inv = 1 - u;
                    tmpPos.y = inv * inv * startY + 2 * inv * u * peakY + u * u * landY;
                    itemNode.setWorldPosition(tmpPos);

                    const s = baseScale * Math.min(1.0, 0.4 + u * 0.9);
                    itemNode.setScale(s, s, s);

                    Quat.fromEuler(tmpRot, u * rollSpin, yawEnd, u * 180);
                    itemNode.setWorldRotation(tmpRot);
                },
            })
            .call(() => {
                curEntry.flightTween = null;
                if (!itemNode || !itemNode.isValid) return;
                itemNode.setWorldPosition(landX, landY, landZ);
                itemNode.setScale(baseScale, baseScale, baseScale);
                itemNode.setRotationFromEuler(0, yawEnd, 0);
                if (onLanded) onLanded();

                // Nảy nhẹ khi chạm mặt đất bằng worldPosition an toàn
                const bState = { t: 0 };
                curEntry.bounceTween = tween(bState)
                    .to(0.24, { t: 1 }, {
                        onUpdate: () => {
                            if (!itemNode || !itemNode.isValid) return;
                            const hop = Math.sin(bState.t * Math.PI) * 0.32;
                            itemNode.setWorldPosition(landX, landY + hop, landZ);
                        },
                    })
                    .call(() => {
                        curEntry.bounceTween = null;
                        if (itemNode && itemNode.isValid) {
                            itemNode.setWorldPosition(landX, landY, landZ);
                        }
                    })
                    .start();
            })
            .start();

        return itemNode;
    }

    private stripCollectibleScripts(root: Node): void {
        const comps = root.getComponentsInChildren(Component);
        for (let i = 0; i < comps.length; i++) {
            const c = comps[i];
            if (!c) continue;
            const cname = js.getClassName(c);
            if (cname && !cname.startsWith('cc.')) {
                c.destroy();
            }
        }
    }

    public get activeCount(): number {
        return this._ringNodes.length;
    }

    public clear(): void {
        for (const item of this._ringNodes) {
            if (item.flightTween) item.flightTween.stop();
            if (item.bounceTween) item.bounceTween.stop();
            if (item.node && item.node.isValid) {
                Tween.stopAllByTarget(item.node);
                item.node.destroy();
            }
        }
        this._ringNodes.length = 0;
        this._cursor = 0;
    }
}

/**
 * DefChestChestVfx — Chuyên trách toàn bộ hiệu ứng hình ảnh của Rương Kho Báu:
 * - Rung nắp rương & phóng đồng xu bay về phía tên trộm khi bị cướp.
 * - Kịch bản Thắng: Bật mở nắp rương + FX_Claim_Gold + FX_LevelUp + phun vòng lặp 20 vàng liên tục bằng update(dt).
 * - Kịch bản Thua: Bung vỡ nắp rương, sụp thân rương + FX_Smoke_Die + mảnh vỡ.
 */
@ccclass('DefChestChestVfx')
export class DefChestChestVfx extends Component {
    @property({ type: Node, tooltip: 'Node Visual gốc bên trong BaseClearChest' })
    public visualNode: Node = null;

    @property({ type: Node, tooltip: 'Node thân rương (Visual/UI_Chest/UI_Chest_Box)' })
    public chestBoxNode: Node = null;

    @property({ type: Node, tooltip: 'Node nắp rương (Visual/UI_Chest/UI_Chest_lid)' })
    public chestLidNode: Node = null;

    @property({ type: Prefab, tooltip: 'Prefab Thỏi Vàng (GoldBar.prefab) rơi ra khi Thắng' })
    public goldBarPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Prefab Đồng Xu Vàng (Collectible_Coin.prefab)' })
    public coinPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng ánh sáng vàng khi mở rương Thắng (FX_Claim_Gold.prefab)' })
    public fxClaimGoldPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng cột sáng chiến thắng trên rương (FX_LevelUp.prefab)' })
    public fxLevelUpPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói nổ khi rương vỡ Thua (FX_Smoke_Die.prefab)' })
    public fxSmokeDiePrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng mảnh vỡ văng ra khi rương vỡ Thua (FX_common_impact_bone.prefab)' })
    public fxBreakDebrisPrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa Vàng & VFX (System/Pool)' })
    public poolContainer: Node = null;

    private _stealShakePhase: number = 0;
    private _baseVisualScale: Vec3 = new Vec3(0.5, 0.5, 0.5);
    private _baseLidPos: Vec3 = new Vec3(0, 0.449, -0.52);
    private _baseBoxScale: Vec3 = new Vec3(1, 1, 1);
    private _goldPool: DefChestGoldPool | null = null;
    private _stealCoinPool: Node[] = [];

    // Trạng thái phun vàng liên tục bằng update(dt) (tránh lỗi trùng callback scheduleOnce/schedule của Cocos)
    private _isFountainRunning: boolean = false;
    private _fountainTimer: number = 0;
    private _fountainInterval: number = 0.12;
    private _spawnSoundCounter: number = 0;
    private _landSoundCounter: number = 0;

    protected onLoad(): void {
        this.resolveNodes();
    }

    protected onDestroy(): void {
        this._isFountainRunning = false;
        this.unscheduleAllCallbacks();
        if (this._goldPool) {
            this._goldPool.clear();
            this._goldPool = null;
        }
        for (const c of this._stealCoinPool) {
            if (c && c.isValid) c.destroy();
        }
        this._stealCoinPool.length = 0;
    }

    protected update(dt: number): void {
        if (!this._isFountainRunning || !this._goldPool) return;
        this._fountainTimer -= dt;
        if (this._fountainTimer <= 0) {
            this._fountainTimer = Math.max(0.06, this._fountainInterval);
            this.emitOneFountainGold();
        }
    }

    public resolveNodes(): void {
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('Visual') || this.node;
        }
        if (this.visualNode) {
            this.visualNode.getScale(this._baseVisualScale);
        }
        if (!this.chestBoxNode) {
            this.chestBoxNode = this.node.getChildByPath('Visual/UI_Chest/UI_Chest_Box')
                || this.node.getChildByName('UI_Chest_Box');
        }
        if (this.chestBoxNode) {
            this.chestBoxNode.getScale(this._baseBoxScale);
        }
        if (!this.chestLidNode) {
            this.chestLidNode = this.node.getChildByPath('Visual/UI_Chest/UI_Chest_lid')
                || this.node.getChildByName('UI_Chest_lid');
        }
        if (this.chestLidNode) {
            this.chestLidNode.getPosition(this._baseLidPos);
        }
        if (!this.poolContainer) {
            this.poolContainer = this.node.scene?.getChildByPath('System/Pool') || this.node.parent;
        }
    }

    public resetChestPose(): void {
        if (this.visualNode && this.visualNode.isValid) {
            this.visualNode.setScale(this._baseVisualScale);
            this.visualNode.setRotationFromEuler(0, 0, 0);
        }
        if (this.chestLidNode && this.chestLidNode.isValid) {
            this.chestLidNode.setPosition(this._baseLidPos);
            this.chestLidNode.setRotationFromEuler(0, 0, 0);
        }
    }

    public updateStealWobble(dt: number): void {
        this._stealShakePhase += dt * 32;
        if (this.visualNode && this.visualNode.isValid) {
            const wobble = Math.sin(this._stealShakePhase) * 3.5;
            this.visualNode.setRotationFromEuler(0, wobble, Math.cos(this._stealShakePhase * 1.3) * 2.5);
        }
        if (this.chestLidNode && this.chestLidNode.isValid) {
            const lidOpenAngle = -10 - Math.abs(Math.sin(this._stealShakePhase * 0.65)) * 12;
            this.chestLidNode.setRotationFromEuler(lidOpenAngle, 0, 0);
        }
    }

    public spawnStealCoinToEnemy(enemyNode: Node): void {
        const prefab = this.coinPrefab || this.goldBarPrefab;
        if (!prefab || !enemyNode || !enemyNode.isValid) return;

        let coin: Node | null = null;
        while (this._stealCoinPool.length > 0) {
            const candidate = this._stealCoinPool.pop()!;
            if (candidate && candidate.isValid) {
                coin = candidate;
                break;
            }
        }
        if (!coin) {
            coin = instantiate(prefab);
            const comps = coin.getComponentsInChildren(Component);
            for (let i = 0; i < comps.length; i++) {
                const c = comps[i];
                const cname = js.getClassName(c);
                if (cname && !cname.startsWith('cc.')) {
                    c.destroy();
                }
            }
        }

        const container = this.poolContainer || (this.node.scene as any);
        coin.setParent(container);
        coin.active = true;

        const chestPos = this.node.worldPosition;
        const startPos = new Vec3(chestPos.x, chestPos.y + 1.15, chestPos.z);
        const endPos = new Vec3();
        enemyNode.getWorldPosition(endPos);
        endPos.y += 0.85;

        coin.setWorldPosition(startPos);
        coin.setScale(1.05, 1.05, 1.05);
        AudioManager.instance?.playCoinFlying();

        const state = { t: 0 };
        const cur = new Vec3();
        tween(state)
            .to(0.28, { t: 1 }, {
                onUpdate: () => {
                    if (!coin || !coin.isValid) return;
                    const u = state.t;
                    if (enemyNode && enemyNode.isValid) {
                        enemyNode.getWorldPosition(endPos);
                        endPos.y += 0.85;
                    }
                    cur.x = startPos.x + (endPos.x - startPos.x) * u;
                    cur.z = startPos.z + (endPos.z - startPos.z) * u;
                    cur.y = startPos.y + (endPos.y - startPos.y) * u + Math.sin(u * Math.PI) * 1.15;
                    coin.setWorldPosition(cur);
                    coin.setRotationFromEuler(u * 540, u * 360, 0);
                },
            })
            .call(() => {
                if (coin && coin.isValid) {
                    coin.active = false;
                    this._stealCoinPool.push(coin);
                }
            })
            .start();
    }

    private emitOneFountainGold(): void {
        if (!this.isValid || !this.node || !this.node.isValid || !this._goldPool) return;
        this._spawnSoundCounter++;
        if (this._spawnSoundCounter % 2 === 1) {
            AudioManager.instance?.playCoinFlying();
        }
        const chestPos = this.node.worldPosition;
        this._goldPool.spawnOrRecycleGoldDrop(chestPos, chestPos.y + 0.08, () => {
            this._landSoundCounter++;
            if (this._landSoundCounter % 3 === 1) {
                AudioManager.instance?.playCoinLand();
            }
        });
    }

    public playWinOpenAndGoldFountain(): void {
        this.resetChestPose();
        AudioManager.instance?.playChestOpen();

        if (this.visualNode && this.visualNode.isValid) {
            const base = this._baseVisualScale.clone();
            tween(this.visualNode)
                .to(0.10, { scale: new Vec3(base.x * 1.12, base.y * 0.86, base.z * 1.12) })
                .to(0.18, { scale: new Vec3(base.x * 0.95, base.y * 1.14, base.z * 0.95) }, { easing: 'backOut' })
                .to(0.14, { scale: base })
                .start();
        }

        if (this.chestLidNode && this.chestLidNode.isValid) {
            const rotState = { pitch: 0 };
            tween(rotState)
                .to(0.42, { pitch: -110 }, {
                    easing: 'backOut',
                    onUpdate: () => {
                        if (this.chestLidNode && this.chestLidNode.isValid) {
                            this.chestLidNode.setRotationFromEuler(rotState.pitch, 0, 0);
                        }
                    },
                })
                .start();
        }

        const chestPos = this.node.worldPosition.clone();
        const container = this.poolContainer || (this.node.scene as any);

        if (this.fxClaimGoldPrefab && container) {
            const fxGold = instantiate(this.fxClaimGoldPrefab);
            fxGold.setParent(container);
            fxGold.setWorldPosition(chestPos.x, chestPos.y + 1.25, chestPos.z);
            fxGold.setScale(1.8, 1.8, 1.8);
            fxGold.active = true;
        }
        if (this.fxLevelUpPrefab && container) {
            const fxLight = instantiate(this.fxLevelUpPrefab);
            fxLight.setParent(container);
            fxLight.setWorldPosition(chestPos.x, chestPos.y + 0.35, chestPos.z);
            fxLight.setScale(1.45, 1.45, 1.45);
            fxLight.active = true;
        }

        const cfg = DefChestConfig.instance;
        const maxGold = cfg ? cfg.winMaxGoldPoolCount : 20;
        this._fountainInterval = cfg ? cfg.winGoldSpawnInterval : 0.12;
        this._spawnSoundCounter = 0;
        this._landSoundCounter = 0;

        if (!this._goldPool && container) {
            this._goldPool = new DefChestGoldPool(this.goldBarPrefab, this.coinPrefab, container, maxGold);
        }

        // Bật đài phun vàng liên tục bằng update(dt) + phun ngay đợt đầu 4 cục vàng bung từ miệng rương
        this._isFountainRunning = true;
        this._fountainTimer = this._fountainInterval;
        for (let i = 0; i < 4; i++) {
            this.emitOneFountainGold();
        }
    }

    public playLoseShatter(): void {
        this._isFountainRunning = false;
        AudioManager.instance?.playChestBreak();

        const chestPos = this.node.worldPosition.clone();
        const container = this.poolContainer || (this.node.scene as any);

        if (this.fxSmokeDiePrefab && container) {
            const smoke = instantiate(this.fxSmokeDiePrefab);
            smoke.setParent(container);
            smoke.setWorldPosition(chestPos.x, chestPos.y + 0.55, chestPos.z);
            smoke.setScale(2.1, 2.1, 2.1);
            smoke.active = true;
        }
        for (let i = 0; i < 3; i++) {
            if (this.fxBreakDebrisPrefab && container) {
                const debris = instantiate(this.fxBreakDebrisPrefab);
                debris.setParent(container);
                debris.setWorldPosition(
                    chestPos.x + (Math.random() - 0.5) * 0.8,
                    chestPos.y + 0.35 + i * 0.15,
                    chestPos.z + (Math.random() - 0.5) * 0.8
                );
                debris.setScale(1.7, 1.7, 1.7);
                debris.active = true;
            }
        }

        if (this.chestLidNode && this.chestLidNode.isValid) {
            Tween.stopAllByTarget(this.chestLidNode);
            tween(this.chestLidNode)
                .to(0.28, {
                    position: new Vec3(this._baseLidPos.x + 0.55, 0.08, this._baseLidPos.z + 0.45),
                }, { easing: 'quadOut' })
                .start();
            this.chestLidNode.setRotationFromEuler(-28, 46, 64);
        }

        if (this.chestBoxNode && this.chestBoxNode.isValid) {
            Tween.stopAllByTarget(this.chestBoxNode);
            tween(this.chestBoxNode)
                .to(0.22, {
                    scale: new Vec3(this._baseBoxScale.x * 1.14, this._baseBoxScale.y * 0.48, this._baseBoxScale.z * 1.10),
                }, { easing: 'bounceOut' })
                .start();
            this.chestBoxNode.setRotationFromEuler(14, -22, 18);
        }
    }

    public get goldPool(): DefChestGoldPool | null {
        return this._goldPool;
    }
}
