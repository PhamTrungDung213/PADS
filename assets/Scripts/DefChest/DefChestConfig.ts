import { _decorator, Component, SpriteFrame, Material } from 'cc';
import {
    DefChestHeroRole,
    DefChestUpgradeTier,
    DefChestEnemyKind,
    DefChestSkillOption,
} from './DefChestTypes';
import { DefChestHeroConfig } from './Config/DefChestHeroConfig';
import { DefChestEnemyConfig } from './Config/DefChestEnemyConfig';
import { DefChestSkillUpgradeConfig } from './Config/DefChestSkillUpgradeConfig';
import { DefChestIconConfig } from './Config/DefChestIconConfig';
import { DefChestWorldConfig } from './Config/DefChestWorldConfig';

export { DefChestHeroRole, DefChestUpgradeTier, DefChestEnemyKind };
export type { DefChestSkillOption };

const { ccclass, property } = _decorator;

const GRP_SUB = { name: 'Bảng Thông Số Con', id: 'sub_configs', displayOrder: 1, style: 'section' };

/** Facade tổng hợp 5 bảng cấu hình con dưới System/Config. */
@ccclass('DefChestConfig')
export class DefChestConfig extends Component {
    public static instance: DefChestConfig | null = null;

    @property({ group: GRP_SUB, type: DefChestHeroConfig, tooltip: 'Thông số phe Ta (01_Ta_Hero)' })
    public heroConfig: DefChestHeroConfig = null;

    @property({ group: GRP_SUB, type: DefChestEnemyConfig, tooltip: 'Thông số phe Địch & Boss (02_Dich_Enemy)' })
    public enemyConfig: DefChestEnemyConfig = null;

    @property({ group: GRP_SUB, type: DefChestSkillUpgradeConfig, tooltip: 'Nâng cấp & Skill (03_NangCap_Skill)' })
    public skillUpgradeConfig: DefChestSkillUpgradeConfig = null;

    @property({ group: GRP_SUB, type: DefChestIconConfig, tooltip: '18 Icon kỹ năng (04_Icon_Skill)' })
    public iconConfig: DefChestIconConfig = null;

    @property({ group: GRP_SUB, type: DefChestWorldConfig, tooltip: 'Wave, Rương & Camera (05_Wave_Ruong_Map)' })
    public worldConfig: DefChestWorldConfig = null;

    protected onLoad(): void {
        DefChestConfig.instance = this;
        this.resolveSubConfigs();
        this.skillUpgradeConfig?.preloadFallbackBanners();
        this.iconConfig?.preloadFallbackIcons();
    }

    protected onDestroy(): void {
        if (DefChestConfig.instance === this) DefChestConfig.instance = null;
    }

    public resolveSubConfigs(): void {
        if (!this.heroConfig) this.heroConfig = this.node.getComponentInChildren(DefChestHeroConfig);
        if (!this.enemyConfig) this.enemyConfig = this.node.getComponentInChildren(DefChestEnemyConfig);
        if (!this.skillUpgradeConfig) this.skillUpgradeConfig = this.node.getComponentInChildren(DefChestSkillUpgradeConfig);
        if (!this.iconConfig) this.iconConfig = this.node.getComponentInChildren(DefChestIconConfig);
        if (!this.worldConfig) this.worldConfig = this.node.getComponentInChildren(DefChestWorldConfig);
    }

    // Phe Ta
    public get squadMoveSpeed(): number { return this.heroConfig?.squadMoveSpeed ?? 4.6; }
    public get formationFollowSpeed(): number { return this.heroConfig?.formationFollowSpeed ?? 10.5; }
    public get heroRotateSpeed(): number { return this.heroConfig?.heroRotateSpeed ?? 16.0; }
    public get heroShoreInset(): number { return this.heroConfig?.heroShoreInset ?? 0.55; }
    public get heroCollisionRadius(): number { return this.heroConfig?.heroCollisionRadius ?? 0.45; }

    public get paladinMaxHp(): number { return this.heroConfig?.paladinMaxHp ?? 420; }
    public get paladinBaseDamage(): number { return this.heroConfig?.paladinBaseDamage ?? 22; }
    public get paladinAttackRange(): number { return this.heroConfig?.paladinAttackRange ?? 2.15; }
    public get paladinAttackCooldown(): number { return this.heroConfig?.paladinAttackCooldown ?? 0.58; }

    public get warriorMaxHp(): number { return this.heroConfig?.warriorMaxHp ?? 450; }
    public get warriorStage1Damage(): number { return this.heroConfig?.warriorStage1Damage ?? 20; }
    public get warriorStage2Damage(): number { return this.heroConfig?.warriorStage2Damage ?? 38; }
    public get warriorStage3Damage(): number { return this.heroConfig?.warriorStage3Damage ?? 68; }
    public get warriorAttackRange(): number { return this.heroConfig?.warriorAttackRange ?? 2.0; }
    public get warriorAttackCooldown(): number { return this.heroConfig?.warriorAttackCooldown ?? 0.50; }

    public get rangerMaxHp(): number { return this.heroConfig?.rangerMaxHp ?? 340; }
    public get rangerBaseDamage(): number { return this.heroConfig?.rangerBaseDamage ?? 24; }
    public get rangerAttackRange(): number { return this.heroConfig?.rangerAttackRange ?? 5.2; }
    public get rangerAttackCooldown(): number { return this.heroConfig?.rangerAttackCooldown ?? 0.62; }
    public get arrowSpeed(): number { return this.heroConfig?.arrowSpeed ?? 13.5; }

    // Phe Địch
    public get basicEnemyHp(): number { return this.enemyConfig?.basicEnemyHp ?? 150; }
    public get basicEnemyDamage(): number { return this.enemyConfig?.basicEnemyDamage ?? 9; }
    public get basicEnemyScale(): number { return this.enemyConfig?.basicEnemyScale ?? 1.18; }
    public get basicEnemyMoveSpeed(): number { return this.enemyConfig?.basicEnemyMoveSpeed ?? 2.35; }
    public get basicEnemyStealRate(): number { return this.enemyConfig?.basicEnemyStealRate ?? 2.8; }
    public get basicEnemyAggroRadius(): number { return this.enemyConfig?.basicEnemyAggroRadius ?? 2.6; }

    public get eliteEnemyHp(): number { return this.enemyConfig?.eliteEnemyHp ?? 2600; }
    public get eliteEnemyDamage(): number { return this.enemyConfig?.eliteEnemyDamage ?? 48; }
    public get eliteEnemySkillDamage(): number { return this.enemyConfig?.eliteEnemySkillDamage ?? 90; }
    public get eliteEnemyScale(): number { return this.enemyConfig?.eliteEnemyScale ?? 2.05; }
    public get eliteEnemyAttackRange(): number { return this.enemyConfig?.eliteEnemyAttackRange ?? 2.55; }
    public get eliteEnemyMoveSpeed(): number { return this.enemyConfig?.eliteEnemyMoveSpeed ?? 2.45; }
    public get eliteEnemyStealRate(): number { return this.enemyConfig?.eliteEnemyStealRate ?? 9.0; }
    public get eliteSkillChestBurstDrain(): number { return this.enemyConfig?.eliteSkillChestBurstDrain ?? 12.0; }
    public get eliteAdvanceAfterHitDuration(): number { return this.enemyConfig?.eliteAdvanceAfterHitDuration ?? 1.65; }

    public get enemyShoreInset(): number { return this.enemyConfig?.enemyShoreInset ?? 0.32; }
    public get enemyCollisionRadius(): number { return this.enemyConfig?.enemyCollisionRadius ?? 0.42; }
    public get enemyOutlineWidth(): number { return this.enemyConfig?.enemyOutlineWidth ?? 0.022; }
    public get enemyOutlineRedMat(): Material { return this.enemyConfig?.enemyOutlineRedMat ?? null; }

    // Nâng cấp & Skill
    public get purpleBannerFrame(): SpriteFrame { return this.skillUpgradeConfig?.purpleBannerFrame ?? null; }
    public get goldBannerFrame(): SpriteFrame { return this.skillUpgradeConfig?.goldBannerFrame ?? null; }
    public get fastCardSpinDuration(): number { return this.skillUpgradeConfig?.fastCardSpinDuration ?? 0.48; }
    public get upgradeHealRatio(): number { return this.skillUpgradeConfig?.upgradeHealRatio ?? 0.45; }
    public get critRate(): number { return this.skillUpgradeConfig?.critRate ?? 0.25; }
    public get critMultiplier(): number { return this.skillUpgradeConfig?.critMultiplier ?? 2.0; }
    public get paladinAuraRadius(): number { return this.skillUpgradeConfig?.paladinAuraRadius ?? 3.6; }
    public get paladinAuraDamage(): number { return this.skillUpgradeConfig?.paladinAuraDamage ?? 12; }

    // Icon Skill
    public get iconPaladinThunder(): SpriteFrame { return this.iconConfig?.iconPaladinThunder ?? null; }
    public get iconPaladinSun(): SpriteFrame { return this.iconConfig?.iconPaladinSun ?? null; }
    public get iconPaladinProtective(): SpriteFrame { return this.iconConfig?.iconPaladinProtective ?? null; }
    public get iconPaladinBonk(): SpriteFrame { return this.iconConfig?.iconPaladinBonk ?? null; }
    public get iconPaladinBurnBurnBurn(): SpriteFrame { return this.iconConfig?.iconPaladinBurnBurnBurn ?? null; }
    public get iconPaladinRighteousFury(): SpriteFrame { return this.iconConfig?.iconPaladinRighteousFury ?? null; }

    public get iconWarriorAttackCone(): SpriteFrame { return this.iconConfig?.iconWarriorAttackCone ?? null; }
    public get iconWarriorCharge(): SpriteFrame { return this.iconConfig?.iconWarriorCharge ?? null; }
    public get iconWarriorShellShock(): SpriteFrame { return this.iconConfig?.iconWarriorShellShock ?? null; }
    public get iconWarriorHeavyHand(): SpriteFrame { return this.iconConfig?.iconWarriorHeavyHand ?? null; }
    public get iconWarriorBerserker(): SpriteFrame { return this.iconConfig?.iconWarriorBerserker ?? null; }
    public get iconWarriorSpikes(): SpriteFrame { return this.iconConfig?.iconWarriorSpikes ?? null; }

    public get iconRangerDoubleShot(): SpriteFrame { return this.iconConfig?.iconRangerDoubleShot ?? null; }
    public get iconRangerRicochet(): SpriteFrame { return this.iconConfig?.iconRangerRicochet ?? null; }
    public get iconRangerFireArrow(): SpriteFrame { return this.iconConfig?.iconRangerFireArrow ?? null; }
    public get iconRangerTripleShot(): SpriteFrame { return this.iconConfig?.iconRangerTripleShot ?? null; }
    public get iconRangerSkewerKabob(): SpriteFrame { return this.iconConfig?.iconRangerSkewerKabob ?? null; }
    public get iconRangerLightningArrow(): SpriteFrame { return this.iconConfig?.iconRangerLightningArrow ?? null; }

    // Wave, Rương & Camera
    public get wave1BasicCount(): number { return this.worldConfig?.wave1BasicCount ?? 5; }
    public get wave2DirectionCount(): number { return this.worldConfig?.wave2DirectionCount ?? 2; }
    public get wave2BasicPerDirection(): number { return this.worldConfig?.wave2BasicPerDirection ?? 5; }
    public get wave3EliteCount(): number { return this.worldConfig?.wave3EliteCount ?? 1; }
    public get wave3BasicPerDirection(): number { return this.worldConfig?.wave3BasicPerDirection ?? 5; }
    public get spawnStaggerInterval(): number { return this.worldConfig?.spawnStaggerInterval ?? 0.42; }

    public get maxTreasure(): number { return this.worldConfig?.maxTreasure ?? 100.0; }
    public get chestPriorityRadius(): number { return this.worldConfig?.chestPriorityRadius ?? 2.85; }
    public get chestStealStopRadius(): number { return this.worldConfig?.chestStealStopRadius ?? 1.95; }
    public get winMaxGoldPoolCount(): number { return this.worldConfig?.winMaxGoldPoolCount ?? 20; }
    public get winGoldSpawnInterval(): number { return this.worldConfig?.winGoldSpawnInterval ?? 0.12; }

    public get camFollowSpeed(): number { return this.worldConfig?.camFollowSpeed ?? 8.5; }
    public get baseFov(): number { return this.worldConfig?.baseFov ?? 45.0; }
    public get maxFov(): number { return this.worldConfig?.maxFov ?? 68.0; }
    public get viewportSafeMargin(): number { return this.worldConfig?.viewportSafeMargin ?? 0.33; }
    public get heroSpreadThreshold(): number { return this.worldConfig?.heroSpreadThreshold ?? 3.2; }
    public get fovExpandGain(): number { return this.worldConfig?.fovExpandGain ?? 4.2; }
    public get fovSmoothSpeed(): number { return this.worldConfig?.fovSmoothSpeed ?? 6.0; }
}
