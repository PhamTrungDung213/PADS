import {
    _decorator,
    Component,
    Node,
    Prefab,
    Vec3,
    Color,
} from 'cc';
import { IDefChestHeroTarget } from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { AudioManager } from '../System/AudioManager';
import { DefChestTreasureChest } from './DefChestTreasureChest';
import { DefChestCameraController } from './DefChestCameraController';
import { EliteCycleAttackStrategy, spawnOneShotVfx } from './DefChestSkillStrategies';
import { DefChestEnemyVisual } from './DefChestEnemyVisual';
import { PaladinGroundFx } from '../VFX/PaladinGroundFx';

const { ccclass, property } = _decorator;

const C_ELITE_RING = new Color(255, 55, 35, 255);
const C_ELITE_CRACK = new Color(255, 95, 45, 255);

/** Xử lý đòn đánh Quái, chu kỳ Special Skill của SkeletonK và Burn DoT. */
@ccclass('DefChestEnemyCombat')
export class DefChestEnemyCombat extends Component {
    @property({ type: Prefab, tooltip: 'Hiệu ứng nổ lửa khi SkeletonK tung Special Skill' })
    public fxEliteSkillPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói khi quái chết (FX_Smoke_Die)' })
    public fxSmokeDiePrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng xương vỡ khi trúng đòn / chết (FX_common_impact_bone)' })
    public fxBoneHitPrefab: Prefab = null;

    public readonly eliteCycle: EliteCycleAttackStrategy = new EliteCycleAttackStrategy(3);

    private _burnTimer: number = 0;
    private _burnTickAccum: number = 0;
    private _burnDps: number = 0;

    public resetCombatState(): void {
        this.eliteCycle.reset();
        this._burnTimer = 0;
        this._burnTickAccum = 0;
        this._burnDps = 0;
    }

    public executeAttackOnHero(params: {
        hero: IDefChestHeroTarget;
        isElite: boolean;
        attackDamage: number;
        skillDamage: number;
        visual: DefChestEnemyVisual | null;
        vfxContainer: Node | null;
        getHeroes: (() => IDefChestHeroTarget[]) | null;
        isDeadCheck: () => boolean;
    }): number {
        const { hero, isElite, attackDamage, skillDamage, visual, vfxContainer, getHeroes, isDeadCheck } = params;

        if (isElite && this.eliteCycle.nextAttackIsSpecialSkill()) {
            this.triggerEliteSpecialSkill(
                hero.node.worldPosition,
                hero,
                null,
                skillDamage,
                visual,
                vfxContainer,
                getHeroes,
                isDeadCheck
            );
            return 0.65;
        }

        visual?.playAttack(false);
        AudioManager.instance?.playAttack();

        this.scheduleOnce(() => {
            if (isDeadCheck() || !this.isValid) return;
            if (hero && !hero.isDead && hero.node && hero.node.isValid) {
                hero.takeDamage(attackDamage, this.node);
            }
            if (!isDeadCheck()) visual?.playWalk();
        }, 0.22);

        return 0.40;
    }

    public executeAttackOnChest(params: {
        chest: DefChestTreasureChest | null;
        chestPos: Vec3;
        isElite: boolean;
        skillDamage: number;
        visual: DefChestEnemyVisual | null;
        vfxContainer: Node | null;
        getHeroes: (() => IDefChestHeroTarget[]) | null;
        isDeadCheck: () => boolean;
    }): number {
        const { chest, chestPos, isElite, skillDamage, visual, vfxContainer, getHeroes, isDeadCheck } = params;

        if (isElite && this.eliteCycle.nextAttackIsSpecialSkill()) {
            this.triggerEliteSpecialSkill(
                chestPos,
                null,
                chest,
                skillDamage,
                visual,
                vfxContainer,
                getHeroes,
                isDeadCheck
            );
            return 0.65;
        }

        visual?.playAttack(false);
        return 0.38;
    }

    private triggerEliteSpecialSkill(
        impactPos: Vec3,
        primaryHero: IDefChestHeroTarget | null,
        targetChest: DefChestTreasureChest | null,
        skillDamage: number,
        visual: DefChestEnemyVisual | null,
        vfxContainer: Node | null,
        getHeroes: (() => IDefChestHeroTarget[]) | null,
        isDeadCheck: () => boolean
    ): void {
        visual?.playAttack(true);
        const targetPos = impactPos.clone();

        this.scheduleOnce(() => {
            if (isDeadCheck() || !this.isValid) return;
            AudioManager.instance?.playHeavySlam();
            DefChestCameraController.instance?.shake(0.30, 0.26);

            const vfxParent = vfxContainer || this.node.parent;
            if (vfxParent) {
                PaladinGroundFx.ring(targetPos, { from: 0.5, to: 3.45, duration: 0.45, color: C_ELITE_RING });
                PaladinGroundFx.streaks(targetPos, { radius: 2.8, duration: 0.72, kind: 'crack', color: C_ELITE_CRACK });
                spawnOneShotVfx(this.fxEliteSkillPrefab, vfxParent, targetPos, 1.75, 1.2, 0.25);
            }

            const heroes = getHeroes ? getHeroes() : [];
            const aoeR2 = 3.35 * 3.35;
            for (let i = 0; i < heroes.length; i++) {
                const h = heroes[i];
                if (!h || h.isDead || !h.node.isValid) continue;
                const hp = h.node.worldPosition;
                if (h === primaryHero || (hp.x - targetPos.x) ** 2 + (hp.z - targetPos.z) ** 2 <= aoeR2) {
                    h.takeDamage(skillDamage, this.node);
                }
            }

            if (targetChest && !targetChest.isEnded) {
                const burst = DefChestConfig.instance ? DefChestConfig.instance.eliteSkillChestBurstDrain : 12.0;
                targetChest.applyEliteSkillBurstDrain(burst, this.node);
            }

            if (!isDeadCheck()) visual?.playWalk();
        }, 0.32);
    }

    public spawnHitFx(vfxContainer: Node | null): void {
        if (!this.fxBoneHitPrefab) return;
        const root = vfxContainer || this.node.parent;
        spawnOneShotVfx(this.fxBoneHitPrefab, root, this.node.worldPosition, 0.75, 0.55, 0.65);
    }

    public spawnDeathFx(vfxContainer: Node | null): void {
        const root = vfxContainer || this.node.parent;
        const pos = this.node.worldPosition;
        spawnOneShotVfx(this.fxSmokeDiePrefab, root, pos, 1.15, 0.9, 0.35);
        spawnOneShotVfx(this.fxBoneHitPrefab, root, pos, 1.15, 0.8, 0.5);
    }

    public applyBurn(dps: number, duration: number, visual: DefChestEnemyVisual | null, burnPrefab?: Prefab | null): void {
        this._burnDps = Math.max(this._burnDps, dps);
        this._burnTimer = Math.max(this._burnTimer, duration);
        visual?.attachBurnLoop(burnPrefab);
    }

    public updateBurn(dt: number, visual: DefChestEnemyVisual | null, onTickDamage: (dmg: number) => void): void {
        if (this._burnTimer <= 0) return;
        this._burnTimer -= dt;
        this._burnTickAccum += dt;
        if (this._burnTickAccum >= 0.45) {
            const tickDmg = Math.max(1, Math.round(this._burnDps * this._burnTickAccum));
            this._burnTickAccum = 0;
            onTickDamage(tickDmg);
        }
        if (this._burnTimer <= 0) {
            this.clearBurn(visual);
        }
    }

    public clearBurn(visual: DefChestEnemyVisual | null): void {
        this._burnTimer = 0;
        this._burnTickAccum = 0;
        this._burnDps = 0;
        visual?.clearBurnLoop();
    }
}
