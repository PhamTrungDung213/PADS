import {
    _decorator,
    Component,
    Node,
    Vec3,
    Prefab,
    Material,
} from 'cc';
import {
    DefChestEnemyKind,
    IDefChestEnemyTarget,
    IDefChestHeroTarget,
} from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { AudioManager } from '../System/AudioManager';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { BarAttacher, BarAttacherMode } from '../UI/BarAttacher';
import { DefChestTreasureChest } from './DefChestTreasureChest';
import { EliteCycleAttackStrategy } from './DefChestSkillStrategies';
import { DefChestEnemyVisual } from './DefChestEnemyVisual';
import { DefChestEnemyCombat } from './DefChestEnemyCombat';
import { DefChestEnemyLocomotion } from './DefChestEnemyLocomotion';
import { DamageTextManager } from '../System/DamageTextManger';

const { ccclass, property } = _decorator;

export type { IDefChestHeroTarget };

enum EnemyAIState {
    MOVE_TO_CHEST = 0,
    AGGRO_HERO = 1,          // Basic thief: đánh nhân vật khi ở gần nhân vật (và chưa gần rương)
    HIT_AND_ADVANCE = 2,     // Elite thief (SkeletonK): đánh nhân vật 1 cái rồi chạy tiếp tới rương
    STEALING_CHEST = 3,      // Khi đã gần rương: ưu tiên đánh/mở rương, kệ nhân vật
    DEAD = 4,
}

let _nextEnemyUid = 1;
const _fallbackChestPos = new Vec3(2.95, 0.2, -0.146);

/**
 * DefChestEnemyController — Điều phối AI State Machine & máu của Quái,
 * liên kết `DefChestEnemyLocomotion`, `DefChestEnemyVisual`, `DefChestEnemyCombat` và `BarAttacher`.
 */
@ccclass('DefChestEnemyController')
export class DefChestEnemyController extends Component implements IDefChestEnemyTarget {
    public static readonly activeList: DefChestEnemyController[] = [];

    @property({ tooltip: 'Loại kẻ địch: BASIC (SkeletonMelee) hoặc ELITE (SkeletonK)' })
    public enemyKind: string = DefChestEnemyKind.BASIC;

    @property({ type: DefChestEnemyVisual, tooltip: 'Component điều khiển hoạt ảnh & viền đỏ' })
    public visual: DefChestEnemyVisual = null;

    @property({ type: DefChestEnemyLocomotion, tooltip: 'Component điều hướng di chuyển' })
    public locomotion: DefChestEnemyLocomotion = null;

    @property({ type: DefChestEnemyCombat, tooltip: 'Component điều khiển đòn đánh & VFX' })
    public combat: DefChestEnemyCombat = null;

    @property({ type: Material, tooltip: 'Material viền đỏ cho Quái (M_DefChest_Skeleton_OutlineRed)' })
    public outlineRedMat: Material = null;

    @property({ type: Prefab, tooltip: 'Prefab EnemyHpBar gắn làm thanh máu' })
    public enemyHpBarPrefab: Prefab = null;

    public enemyId: number = 0;
    public maxHp: number = 150;
    public currentHp: number = 150;
    public moveSpeed: number = 2.45;
    public attackDamage: number = 9;
    public skillDamage: number = 34;
    public stealRate: number = 2.8;
    public aggroRadius: number = 2.85;
    public attackRange: number = 1.65;
    public attackCooldown: number = 1.05;
    public isDead: boolean = false;
    public isFrozen: boolean = false;
    public isCelebratingVictory: boolean = false;

    private _aiState: EnemyAIState = EnemyAIState.MOVE_TO_CHEST;
    private _barAttacher: BarAttacher | null = null;
    private _attackTimer: number = 0;
    private _reAggroCooldownTimer: number = 0;
    private _actionLockTimer: number = 0;
    private _targetHero: IDefChestHeroTarget | null = null;
    private _stealSlotAngle: number = 0;

    private _getHeroesFn: (() => IDefChestHeroTarget[]) | null = null;
    private _onDeathFn: ((enemy: DefChestEnemyController) => void) | null = null;
    private _vfxContainer: Node | null = null;

    public get _eliteCycle(): EliteCycleAttackStrategy {
        this.ensureSubComponents();
        return this.combat.eliteCycle;
    }

    protected onLoad(): void {
        if (!this.enemyId) this.enemyId = _nextEnemyUid++;
        this.ensureSubComponents();
    }

    private ensureSubComponents(): void {
        if (!this.visual) {
            this.visual = this.getComponent(DefChestEnemyVisual) || this.addComponent(DefChestEnemyVisual);
        }
        if (!this.locomotion) {
            this.locomotion = this.getComponent(DefChestEnemyLocomotion) || this.addComponent(DefChestEnemyLocomotion);
        }
        if (!this.combat) {
            this.combat = this.getComponent(DefChestEnemyCombat) || this.addComponent(DefChestEnemyCombat);
        }
    }

    public initEnemy(params: {
        kind: DefChestEnemyKind;
        spawnWorldPos: Vec3;
        stealSlotAngle: number;
        getHeroes: () => IDefChestHeroTarget[];
        onDeath: (enemy: DefChestEnemyController) => void;
        vfxContainer: Node | null;
        outlineMat?: Material | null;
        enemyHpBarPrefab?: Prefab | null;
        fxEliteSkillPrefab?: Prefab | null;
        fxSmokeDiePrefab?: Prefab | null;
        fxBoneHitPrefab?: Prefab | null;
    }): void {
        if (!this.enemyId) this.enemyId = _nextEnemyUid++;
        this.enemyKind = params.kind;
        this._stealSlotAngle = params.stealSlotAngle;
        this._getHeroesFn = params.getHeroes;
        this._onDeathFn = params.onDeath;
        this._vfxContainer = params.vfxContainer;

        this.ensureSubComponents();

        if (params.outlineMat) this.outlineRedMat = params.outlineMat;
        if (params.enemyHpBarPrefab) this.enemyHpBarPrefab = params.enemyHpBarPrefab;
        if (params.fxEliteSkillPrefab) this.combat.fxEliteSkillPrefab = params.fxEliteSkillPrefab;
        if (params.fxSmokeDiePrefab) this.combat.fxSmokeDiePrefab = params.fxSmokeDiePrefab;
        if (params.fxBoneHitPrefab) this.combat.fxBoneHitPrefab = params.fxBoneHitPrefab;

        const cfg = DefChestConfig.instance;
        const isElite = this.enemyKind === DefChestEnemyKind.ELITE;
        const modelScale = isElite
            ? (cfg ? cfg.eliteEnemyScale : 2.05)
            : (cfg ? cfg.basicEnemyScale : 1.18);

        if (isElite) {
            this.maxHp = cfg ? cfg.eliteEnemyHp : 2600;
            this.moveSpeed = cfg ? cfg.eliteEnemyMoveSpeed : 2.45;
            this.attackDamage = cfg ? cfg.eliteEnemyDamage : 48;
            this.skillDamage = cfg ? cfg.eliteEnemySkillDamage : 90;
            this.stealRate = cfg ? cfg.eliteEnemyStealRate : 9.0;
            this.aggroRadius = 3.6;
            this.attackRange = cfg ? cfg.eliteEnemyAttackRange : 2.55;
            this.attackCooldown = 1.05;
            this.node.setScale(modelScale, modelScale, modelScale);
        } else {
            this.maxHp = cfg ? cfg.basicEnemyHp : 150;
            this.moveSpeed = cfg ? cfg.basicEnemyMoveSpeed : 2.35;
            this.attackDamage = cfg ? cfg.basicEnemyDamage : 9;
            this.skillDamage = this.attackDamage;
            this.stealRate = cfg ? cfg.basicEnemyStealRate : 2.8;
            this.aggroRadius = cfg ? cfg.basicEnemyAggroRadius : 2.6;
            this.attackRange = 1.65;
            this.attackCooldown = 1.05;
            this.node.setScale(modelScale, modelScale, modelScale);
        }

        this.currentHp = this.maxHp;
        this.isDead = false;
        this.isFrozen = false;
        this.isCelebratingVictory = false;
        this._aiState = EnemyAIState.MOVE_TO_CHEST;
        this._attackTimer = 0.2;
        this._reAggroCooldownTimer = 0;
        this._actionLockTimer = 0;
        this._targetHero = null;
        this.combat.resetCombatState();
        this.combat.clearBurn(this.visual);

        if (DefChestEnemyController.activeList.indexOf(this) < 0) {
            DefChestEnemyController.activeList.push(this);
        }

        const startPos = params.spawnWorldPos.clone();
        DefChestArenaBounds.instance?.resolveEnemyPosition(startPos, 0.42, true);
        this.node.setWorldPosition(startPos);

        this.visual.ensureRedOutline(isElite, this.outlineRedMat);
        this.setupHpBar(isElite, modelScale);
        this.visual.resetAnimState();
        this.visual.playWalk(true);
    }

    private setupHpBar(isElite: boolean, modelScale: number): void {
        this._barAttacher = this.node.getComponent(BarAttacher)
            || this.node.addComponent(BarAttacher);
        this._barAttacher.manualMode = BarAttacherMode.ENEMY_HP;
        if (this.enemyHpBarPrefab) this._barAttacher.hpBarPrefab = this.enemyHpBarPrefab;
        this._barAttacher.offset3D = isElite
            ? new Vec3(0, Math.max(2.35, 1.65 * modelScale), 0)
            : new Vec3(0, Math.max(1.45, 1.32 * modelScale), 0);
        this._barAttacher.barScale = isElite
            ? Math.max(0.0115, 0.0072 * modelScale)
            : 0.0085;
        this._barAttacher.setRatio(1.0);
    }

    protected update(dt: number): void {
        if (this.isDead || this._aiState === EnemyAIState.DEAD) return;
        if (this.isCelebratingVictory) {
            this.visual?.updateVictoryJump(dt);
            return;
        }
        if (this.isFrozen) return;

        this.combat?.updateBurn(dt, this.visual, (dmg) => this.takeDamage(dmg, false));
        if (this.isDead) return;

        if (this._attackTimer > 0) this._attackTimer -= dt;
        if (this._reAggroCooldownTimer > 0) this._reAggroCooldownTimer -= dt;
        if (this._actionLockTimer > 0) {
            this._actionLockTimer -= dt;
            return;
        }

        const chest = DefChestTreasureChest.getOrResolve();
        if (chest && chest.isEnded) {
            this.unregisterFromChest();
            this.visual?.playIdle();
            return;
        }

        const cfg = DefChestConfig.instance;
        const chestPriorityR = cfg ? cfg.chestPriorityRadius : 2.85;
        const chestStopR = cfg ? cfg.chestStealStopRadius : 1.95;
        const isElite = this.enemyKind === DefChestEnemyKind.ELITE;

        const myPos = this.node.worldPosition;
        const chestPos = (chest && chest.node && chest.node.isValid)
            ? chest.node.worldPosition
            : _fallbackChestPos;
        const distToChest = Math.sqrt((chestPos.x - myPos.x) ** 2 + (chestPos.z - myPos.z) ** 2);

        // QUY TẮC AI #1: Khi đã gần Rương (<= chestPriorityRadius) -> Ưu tiên đánh/mở Rương, kệ nhân vật!
        if (distToChest <= chestPriorityR) {
            this._targetHero = null;
            if (distToChest <= chestStopR + 0.30) {
                this._aiState = EnemyAIState.STEALING_CHEST;
                this.locomotion?.faceToward(chestPos.x, chestPos.z);
                chest?.registerStealer(this.enemyId, this.node, this.stealRate);
                if (this._attackTimer <= 0 && this.combat) {
                    this._attackTimer = this.attackCooldown;
                    this._actionLockTimer = this.combat.executeAttackOnChest({
                        chest,
                        chestPos,
                        isElite,
                        skillDamage: this.skillDamage,
                        visual: this.visual,
                        vfxContainer: this._vfxContainer,
                        getHeroes: this._getHeroesFn,
                        isDeadCheck: () => this.isDead,
                    });
                }
            } else {
                this.unregisterFromChest();
                this._aiState = EnemyAIState.MOVE_TO_CHEST;
                this.locomotion?.moveTowardChestSlot(
                    chestPos,
                    chestStopR,
                    this._stealSlotAngle,
                    this.moveSpeed,
                    this.visual,
                    DefChestEnemyController.activeList,
                    dt
                );
            }
            return;
        }

        this.unregisterFromChest();

        // QUY TẮC AI #2: Trên đường tới Rương -> Nếu gần nhân vật thì đánh nhân vật
        // (SkeletonK đánh nhân vật 1 cái rồi lập tức chạy tiếp tới cái Rương!)
        if (!isElite || this._reAggroCooldownTimer <= 0) {
            const nearHero = this.locomotion?.findNearestLivingHero(this.aggroRadius, this._getHeroesFn) || null;
            this._targetHero = nearHero;
            this._aiState = nearHero
                ? (isElite ? EnemyAIState.HIT_AND_ADVANCE : EnemyAIState.AGGRO_HERO)
                : EnemyAIState.MOVE_TO_CHEST;
        } else {
            this._aiState = EnemyAIState.MOVE_TO_CHEST;
            this._targetHero = null;
        }

        if (this._targetHero && !this._targetHero.isDead && this._targetHero.node.isValid) {
            const hPos = this._targetHero.node.worldPosition;
            const distToHero = Math.sqrt((hPos.x - myPos.x) ** 2 + (hPos.z - myPos.z) ** 2);

            if (distToHero <= this.attackRange) {
                this.locomotion?.faceToward(hPos.x, hPos.z);
                if (this._attackTimer <= 0 && this.combat) {
                    this._attackTimer = this.attackCooldown;
                    this._actionLockTimer = this.combat.executeAttackOnHero({
                        hero: this._targetHero,
                        isElite,
                        attackDamage: this.attackDamage,
                        skillDamage: this.skillDamage,
                        visual: this.visual,
                        vfxContainer: this._vfxContainer,
                        getHeroes: this._getHeroesFn,
                        isDeadCheck: () => this.isDead,
                    });
                    if (isElite) {
                        this._reAggroCooldownTimer = cfg ? cfg.eliteAdvanceAfterHitDuration : 1.65;
                        this._targetHero = null;
                        this._aiState = EnemyAIState.MOVE_TO_CHEST;
                    }
                } else {
                    this.visual?.playIdle();
                }
            } else {
                this.locomotion?.moveTowardPoint(
                    hPos.x,
                    hPos.z,
                    this.moveSpeed,
                    true,
                    this.visual,
                    DefChestEnemyController.activeList,
                    dt
                );
            }
            return;
        }

        this._aiState = EnemyAIState.MOVE_TO_CHEST;
        this.locomotion?.moveTowardChestSlot(
            chestPos,
            chestStopR,
            this._stealSlotAngle,
            this.moveSpeed,
            this.visual,
            DefChestEnemyController.activeList,
            dt
        );
    }

    private unregisterFromChest(): void {
        DefChestTreasureChest.instance?.unregisterStealer(this.enemyId);
    }

    public freezeAndStop(): void {
        if (this.isDead) return;
        this.isFrozen = true;
        this.unscheduleAllCallbacks();
        this.combat?.unscheduleAllCallbacks();
        this.unregisterFromChest();
        this.combat?.clearBurn(this.visual);
        this._barAttacher?.hideBar();
        this.visual?.playIdle();
    }

    public startVictoryJumpLoop(staggerDelaySec: number = 0): void {
        if (this.isDead) return;
        this.isCelebratingVictory = true;
        this.isFrozen = false;
        this.unscheduleAllCallbacks();
        this.combat?.unscheduleAllCallbacks();
        this.unregisterFromChest();
        this.combat?.clearBurn(this.visual);
        this._barAttacher?.hideBar();
        const wp = this.node.worldPosition;
        this.locomotion?.faceToward(wp.x, wp.z - 5.0);
        this.visual?.startVictoryJump(staggerDelaySec);
    }

    public takeDamage(amount: number, isCrit: boolean = false, knockbackDir?: Vec3, knockbackDist: number = 0.22): void {
        if (this.isDead || this.isFrozen || this.isCelebratingVictory || amount <= 0) return;

        const dmg = Math.max(1, Math.round(amount));
        this.currentHp = Math.max(0, this.currentHp - dmg);
        this._barAttacher?.setRatio(this.maxHp > 0 ? this.currentHp / this.maxHp : 0);
        DamageTextManager.instance?.showDamage(this.node, dmg, isCrit);
        this.combat?.spawnHitFx(this._vfxContainer);

        const isElite = this.enemyKind === DefChestEnemyKind.ELITE;
        if (knockbackDir && knockbackDist > 0) {
            this.locomotion?.applyKnockback(knockbackDir, knockbackDist, isElite);
        }

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    public applyBurnDot(dps: number, duration: number, burnPrefab?: Prefab | null): void {
        if (this.isDead || this.isFrozen || this.isCelebratingVictory || dps <= 0 || duration <= 0) return;
        this.combat?.applyBurn(dps, duration, this.visual, burnPrefab);
    }

    private die(): void {
        if (this.isDead) return;
        this.isDead = true;
        this._aiState = EnemyAIState.DEAD;
        this.unscheduleAllCallbacks();
        this.unregisterFromChest();
        this.combat?.clearBurn(this.visual);
        this.removeFromActiveList();

        this._barAttacher?.hideBar();
        AudioManager.instance?.playEnemyDie();
        this.combat?.spawnDeathFx(this._vfxContainer);
        this.visual?.playDie();

        const cb = this._onDeathFn;
        this._onDeathFn = null;
        if (cb) cb(this);
    }

    private removeFromActiveList(): void {
        const idx = DefChestEnemyController.activeList.indexOf(this);
        if (idx >= 0) DefChestEnemyController.activeList.splice(idx, 1);
    }

    protected onDisable(): void {
        this.unscheduleAllCallbacks();
        this.unregisterFromChest();
        this.combat?.clearBurn(this.visual);
        this.removeFromActiveList();
    }
}
