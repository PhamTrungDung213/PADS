import {
    _decorator,
    Component,
    Node,
    Prefab,
    Vec3,
    CCFloat,
} from 'cc';
import {
    DefChestHeroRole,
    DefChestHeroSkillModifiers,
    IDefChestEnemyTarget,
    IDefChestHeroTarget,
    createDefaultHeroSkillModifiers,
} from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { BarAttacher, BarAttacherMode } from '../UI/BarAttacher';
import { DefChestSkillStrategyRegistry } from './DefChestSkillStrategies';
import { DefChestHeroAnim } from './DefChestHeroAnim';
import { DefChestHeroCombat } from './DefChestHeroCombat';
import { DefChestHeroVfxCatalog } from './DefChestHeroVfxCatalog';
import { DefChestHeroLocomotion } from './DefChestHeroLocomotion';

const { ccclass, property } = _decorator;

/**
 * DefChestHeroAgent — Điều phối trạng thái máu, nâng cấp kỹ năng và liên kết các module:
 * `DefChestHeroLocomotion`, `DefChestHeroAnim`, `DefChestHeroCombat`, `DefChestHeroVfxCatalog`, `BarAttacher`.
 */
@ccclass('DefChestHeroAgent')
export class DefChestHeroAgent extends Component implements IDefChestHeroTarget {
    @property({ tooltip: 'Vai trò nhân vật: PALADIN, WARRIOR, hoặc RANGER' })
    public role: string = DefChestHeroRole.PALADIN;

    @property({ type: CCFloat, tooltip: 'Hệ số hướng mặt của Mesh gốc (-1 cho P_Paladin vì mặt quay -Z, +1 cho Warrior & Ranger)' })
    public modelForwardSign: number = 1.0;

    @property({ tooltip: 'Độ lệch vị trí đội hình tam giác so với tâm đội hình (X, 0, Z)' })
    public formationOffset: Vec3 = new Vec3(0, 0, 0);

    @property({ type: DefChestHeroAnim, tooltip: 'Component điều khiển hoạt ảnh & vũ khí' })
    public heroAnim: DefChestHeroAnim = null;

    @property({ type: DefChestHeroLocomotion, tooltip: 'Component điều khiển di chuyển & tự động tìm quái' })
    public locomotion: DefChestHeroLocomotion = null;

    @property({ type: DefChestHeroCombat, tooltip: 'Component điều khiển chiến đấu' })
    public heroCombat: DefChestHeroCombat = null;

    @property({ type: DefChestHeroVfxCatalog, tooltip: 'Component chứa Prefab Đạn & VFX' })
    public vfxCatalog: DefChestHeroVfxCatalog = null;

    @property({ type: BarAttacher, tooltip: 'Component gắn thanh máu ExpBar' })
    public barAttacher: BarAttacher = null;

    @property({ type: Node, tooltip: '[Warrior] Node Dao găm khởi đầu (SM_dagger Socket/dagger)' })
    public warriorDaggerNode: Node = null;

    @property({ type: Node, tooltip: '[Warrior] Node Rìu 1 tay sau GD A (SM_dagger Socket/axe_Tier2)' })
    public warriorAxe1HNode: Node = null;

    @property({ type: Node, tooltip: '[Warrior] Node Rìu 2 tay sau GD B (SM_dagger Socket/two_handed_axe_Tier2)' })
    public warriorAxe2HNode: Node = null;

    @property({ type: Prefab, tooltip: 'Prefab ExpBar dùng làm thanh HP cho Hero' })
    public expBarPrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa Đạn & VFX (System/Pool)' })
    public poolContainer: Node = null;

    public maxHp: number = 420;
    public currentHp: number = 420;
    public baseDamage: number = 22;
    public attackRange: number = 2.4;
    public baseAttackCooldown: number = 0.58;
    public isDead: boolean = false;
    public isCelebrating: boolean = false;

    public readonly skillMods: DefChestHeroSkillModifiers = createDefaultHeroSkillModifiers();
    public readonly unlockedSkills: string[] = [];

    private _attackTimer: number = 0;
    private _auraTimer: number = 0.25;
    private _attackSwingLockTimer: number = 0;

    private _getActiveEnemiesFn: (() => IDefChestEnemyTarget[]) | null = null;
    private _getAllHeroesFn: (() => DefChestHeroAgent[]) | null = null;
    private _onHeroDiedFn: ((hero: DefChestHeroAgent) => void) | null = null;

    protected onLoad(): void {
        this.syncSubComponents();
    }

    private syncSubComponents(): void {
        if (!this.heroAnim) {
            this.heroAnim = this.getComponent(DefChestHeroAnim) || this.addComponent(DefChestHeroAnim);
        }
        if (this.warriorDaggerNode) this.heroAnim.warriorDaggerNode = this.warriorDaggerNode;
        if (this.warriorAxe1HNode) this.heroAnim.warriorAxe1HNode = this.warriorAxe1HNode;
        if (this.warriorAxe2HNode) this.heroAnim.warriorAxe2HNode = this.warriorAxe2HNode;
        this.heroAnim.resolveRefs();

        if (!this.locomotion) {
            this.locomotion = this.getComponent(DefChestHeroLocomotion) || this.addComponent(DefChestHeroLocomotion);
        }

        if (!this.vfxCatalog) {
            this.vfxCatalog = this.getComponent(DefChestHeroVfxCatalog) || this.addComponent(DefChestHeroVfxCatalog);
        }
        if (this.poolContainer) this.vfxCatalog.poolContainer = this.poolContainer;

        if (!this.heroCombat) {
            this.heroCombat = this.getComponent(DefChestHeroCombat) || this.addComponent(DefChestHeroCombat);
        }
        this.heroCombat.vfxCatalog = this.vfxCatalog;

        if (!this.barAttacher) {
            this.barAttacher = this.getComponent(BarAttacher) || this.addComponent(BarAttacher);
        }
        this.barAttacher.manualMode = BarAttacherMode.HERO_EXP_AS_HP;
        if (this.expBarPrefab) this.barAttacher.expBarPrefab = this.expBarPrefab;
        this.barAttacher.offset3D = new Vec3(0, 1.85, 0);
        this.barAttacher.barScale = 0.0092;
    }

    public initHero(params: {
        getActiveEnemies: () => IDefChestEnemyTarget[];
        getAllHeroes: () => DefChestHeroAgent[];
        onHeroDied: (hero: DefChestHeroAgent) => void;
        poolContainer: Node | null;
    }): void {
        this._getActiveEnemiesFn = params.getActiveEnemies;
        this._getAllHeroesFn = params.getAllHeroes;
        this._onHeroDiedFn = params.onHeroDied;
        if (params.poolContainer) this.poolContainer = params.poolContainer;

        this.syncSubComponents();

        const cfg = DefChestConfig.instance;
        if (this.role === DefChestHeroRole.PALADIN) {
            this.modelForwardSign = -1.0;
            this.maxHp = cfg ? cfg.paladinMaxHp : 420;
            this.baseDamage = cfg ? cfg.paladinBaseDamage : 22;
            this.attackRange = cfg ? cfg.paladinAttackRange : 2.15;
            this.baseAttackCooldown = cfg ? cfg.paladinAttackCooldown : 0.58;
        } else if (this.role === DefChestHeroRole.WARRIOR) {
            this.modelForwardSign = 1.0;
            this.maxHp = cfg ? cfg.warriorMaxHp : 450;
            this.baseDamage = cfg ? cfg.warriorStage1Damage : 20;
            this.attackRange = cfg ? cfg.warriorAttackRange : 2.0;
            this.baseAttackCooldown = cfg ? cfg.warriorAttackCooldown : 0.50;
            this.applyWarriorWeaponStage(1);
        } else {
            this.modelForwardSign = 1.0;
            this.maxHp = cfg ? cfg.rangerMaxHp : 340;
            this.baseDamage = cfg ? cfg.rangerBaseDamage : 24;
            this.attackRange = cfg ? cfg.rangerAttackRange : 5.2;
            this.baseAttackCooldown = cfg ? cfg.rangerAttackCooldown : 0.62;
        }

        this.currentHp = this.maxHp;
        this.isDead = false;
        this.isCelebrating = false;
        this.barAttacher?.setRatio(1.0);
        this.heroAnim?.playIdle(true);

        // Khởi đầu Paladin chưa có Aura (chỉ bật sau khi chọn skill Aura)
        if (this.role === DefChestHeroRole.PALADIN) {
            this.heroCombat?.clearPaladinAuraVisuals();
        }
    }

    public applyWarriorWeaponStage(stage: number): void {
        if (this.role !== DefChestHeroRole.WARRIOR) return;
        this.skillMods.weaponStage = stage;

        const cfg = DefChestConfig.instance;
        if (stage === 1) {
            this.baseDamage = cfg ? cfg.warriorStage1Damage : 20;
            this.attackRange = cfg ? cfg.warriorAttackRange : 2.0;
        } else if (stage === 2) {
            this.baseDamage = cfg ? cfg.warriorStage2Damage : 38;
            this.attackRange = (cfg ? cfg.warriorAttackRange : 2.0) + 0.35;
        } else {
            this.baseDamage = cfg ? cfg.warriorStage3Damage : 68;
            this.attackRange = (cfg ? cfg.warriorAttackRange : 2.0) + 0.65;
        }

        this.heroAnim?.setWarriorWeaponStage(this.role, stage);
    }

    public applySkillUpgrade(skillId: string): void {
        this.unlockedSkills.push(skillId);
        DefChestSkillStrategyRegistry.applySkillToModifiers(skillId, this.skillMods);

        if (this.role === DefChestHeroRole.WARRIOR) {
            this.applyWarriorWeaponStage(this.skillMods.weaponStage);
        } else if (this.role === DefChestHeroRole.PALADIN) {
            if (skillId === 'PALADIN_RIGHTEOUS_FURY') {
                const cur = this.node.scale;
                this.node.setScale(cur.x * 1.12, cur.y * 1.12, cur.z * 1.12);
            }
            this.heroCombat?.setupPaladinAuraRings(this.skillMods);
        }

        if (!this.isDead) {
            const healRatio = DefChestConfig.instance ? DefChestConfig.instance.upgradeHealRatio : 0.45;
            this.heal(this.maxHp * healRatio);
        }

        this.heroCombat?.spawnUpgradeFx(skillId);
    }

    public heal(amount: number): void {
        if (this.isDead || amount <= 0) return;
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
        this.barAttacher?.setRatio(this.maxHp > 0 ? this.currentHp / this.maxHp : 0);
    }

    public moveByJoystickStep(stepX: number, stepZ: number, moveDirX: number, moveDirZ: number, dt: number): void {
        if (this.isDead || this.isCelebrating) return;
        this._attackSwingLockTimer = 0;
        this.locomotion?.moveByJoystickStep(
            stepX,
            stepZ,
            moveDirX,
            moveDirZ,
            this.modelForwardSign,
            this.heroAnim,
            this._getAllHeroesFn,
            dt
        );
    }

    public stopJoystickMove(): void {
        this.locomotion?.stopJoystickMove();
    }

    protected update(dt: number): void {
        if (this.isDead) return;

        if (this.role === DefChestHeroRole.PALADIN) {
            this.heroCombat?.updatePaladinAuraVisuals(dt, this.skillMods);
        }

        if (this.isCelebrating) {
            this.heroAnim?.updateVictoryJump(dt);
            return;
        }

        if (this._attackTimer > 0) this._attackTimer -= dt;
        if (this._attackSwingLockTimer > 0) this._attackSwingLockTimer -= dt;

        if (this.role === DefChestHeroRole.PALADIN) {
            this._auraTimer -= dt;
            if (this._auraTimer <= 0) {
                this._auraTimer = 0.58;
                const enemies = this._getActiveEnemiesFn ? this._getActiveEnemiesFn() : [];
                this.heroCombat?.executePaladinAuraPulse(this.skillMods, enemies, (healAmt) => {
                    const allies = this._getAllHeroesFn ? this._getAllHeroesFn() : [];
                    for (let i = 0; i < allies.length; i++) {
                        if (allies[i] && !allies[i].isDead) allies[i].heal(healAmt);
                    }
                });
            }
        }

        if (!this.locomotion?.isMovingByJoystick) {
            this.updateAutoChaseAndAttack(dt);
        }
    }

    private updateAutoChaseAndAttack(dt: number): void {
        const nearestEnemy = this.locomotion?.findNearestEnemy(18.0, this._getActiveEnemiesFn) || null;
        if (!nearestEnemy) {
            if (this._attackSwingLockTimer <= 0) {
                this.heroAnim?.playIdle();
            }
            return;
        }

        if (this._attackSwingLockTimer > 0) return;

        const stopRange = this.attackRange * 0.88;
        const inRange = this.locomotion
            ? this.locomotion.chaseTargetEnemy(
                nearestEnemy,
                stopRange,
                this.modelForwardSign,
                this.heroAnim,
                this._getAllHeroesFn,
                dt
            )
            : false;

        if (!inRange) return;

        if (this._attackTimer <= 0) {
            const effCooldown = Math.max(0.24, this.baseAttackCooldown / this.skillMods.attackSpeedMultiplier);
            this._attackTimer = effCooldown;
            this._attackSwingLockTimer = Math.min(0.38, effCooldown * 0.75);

            const useSkillClip = this.heroCombat
                ? this.heroCombat.executeAttack(
                    this.role,
                    nearestEnemy,
                    this.baseDamage,
                    this.attackRange,
                    this.skillMods,
                    () => (this._getActiveEnemiesFn ? this._getActiveEnemiesFn() : []),
                    (healAmt) => this.heal(healAmt)
                )
                : false;

            this.heroAnim?.playAttack(useSkillClip, 1.75 * this.skillMods.attackSpeedMultiplier);
        } else {
            this.heroAnim?.playIdle();
        }
    }

    public takeDamage(amount: number, attackerNode?: Node): void {
        if (this.isDead || this.isCelebrating || amount <= 0) return;

        let reduction = this.skillMods.damageReduction;
        if (this._getAllHeroesFn) {
            const allies = this._getAllHeroesFn();
            for (let i = 0; i < allies.length; i++) {
                const a = allies[i];
                if (a && !a.isDead && a.skillMods.damageReduction > reduction) {
                    reduction = a.skillMods.damageReduction;
                }
            }
        }

        const finalDmg = Math.max(1, Math.round(amount * (1.0 - reduction)));
        this.currentHp = Math.max(0, this.currentHp - finalDmg);
        this.barAttacher?.setRatio(this.maxHp > 0 ? this.currentHp / this.maxHp : 0);

        if (this.skillMods.hasSpikes && attackerNode && attackerNode.isValid && this._getActiveEnemiesFn) {
            const enemies = this._getActiveEnemiesFn();
            for (let i = 0; i < enemies.length; i++) {
                if (enemies[i].node === attackerNode && !enemies[i].isDead) {
                    enemies[i].takeDamage(18, false);
                    break;
                }
            }
        }

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    private die(): void {
        if (this.isDead) return;
        this.isDead = true;
        this.barAttacher?.hideBar();
        this.heroCombat?.clearPaladinAuraVisuals();
        this.heroCombat?.spawnDeathFx();
        this.heroAnim?.playDie();
        this._onHeroDiedFn?.(this);
    }

    public startVictoryJumpLoop(staggerDelaySec: number = 0): void {
        if (this.isDead) return;
        this.isCelebrating = true;
        this.locomotion?.stopJoystickMove();
        this.barAttacher?.hideBar();
        this.locomotion?.faceDirection(0, -1, this.modelForwardSign, 1.0);
        this.heroAnim?.startVictoryJump(staggerDelaySec);
    }

    /**
     * Dùng khi Thua cuộc (rương vỡ / mất kho báu):
     * Toàn bộ Hero còn sống lập tức gục ngã, tắt hẳn chiến đấu / tự tìm quái / Aura.
     */
    public forceDefeatDie(): void {
        if (this.isDead) return;
        this.isDead = true;
        this.isCelebrating = false;
        this.currentHp = 0;
        this.locomotion?.stopJoystickMove();
        this.barAttacher?.hideBar();
        this.heroCombat?.clearPaladinAuraVisuals();
        this.heroCombat?.spawnDeathFx();
        this.heroAnim?.playDie();
    }
}
