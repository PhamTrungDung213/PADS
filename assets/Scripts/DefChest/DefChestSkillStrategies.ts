import { Node, Prefab, Vec3, Color, instantiate, ParticleSystem } from 'cc';
import {
    DefChestArrowKind,
    DefChestHeroRole,
    DefChestHeroSkillModifiers,
    DefChestSkillOption,
    DefChestUpgradeTier,
    createDefaultHeroSkillModifiers,
} from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { PoolManager } from '../System/PoolManager';

export type { DefChestHeroSkillModifiers };
export { createDefaultHeroSkillModifiers };

export enum DefChestSkillId {
    // Paladin
    PALADIN_THUNDER = 'PALADIN_THUNDER',
    PALADIN_SUN = 'PALADIN_SUN',
    PALADIN_PROTECTIVE = 'PALADIN_PROTECTIVE',
    PALADIN_BONK = 'PALADIN_BONK',
    PALADIN_BURN_BURN = 'PALADIN_BURN_BURN',
    PALADIN_RIGHTEOUS_FURY = 'PALADIN_RIGHTEOUS_FURY',

    // Warrior
    WARRIOR_ATTACK_CONE = 'WARRIOR_ATTACK_CONE',
    WARRIOR_CHARGE = 'WARRIOR_CHARGE',
    WARRIOR_SHELL_SHOCK = 'WARRIOR_SHELL_SHOCK',
    WARRIOR_HEAVY_HAND = 'WARRIOR_HEAVY_HAND',
    WARRIOR_BERSERKER = 'WARRIOR_BERSERKER',
    WARRIOR_SPIKES = 'WARRIOR_SPIKES',

    // Ranger
    RANGER_DOUBLE_SHOT = 'RANGER_DOUBLE_SHOT',
    RANGER_RICOCHET = 'RANGER_RICOCHET',
    RANGER_FIRE_ARROW = 'RANGER_FIRE_ARROW',
    RANGER_TRIPLE_SHOT = 'RANGER_TRIPLE_SHOT',
    RANGER_SKEWER_KABOB = 'RANGER_SKEWER_KABOB',
    RANGER_LIGHTNING_ARROW = 'RANGER_LIGHTNING_ARROW',
}

/** Danh sách 18 kỹ năng và bộ áp dụng chỉ số nâng cấp cho 3 Hero. */
export class DefChestSkillStrategyRegistry {
    public static getSkillOptions(role: DefChestHeroRole, tier: DefChestUpgradeTier): DefChestSkillOption[] {
        const cfg = DefChestConfig.instance;
        const make = (id: DefChestSkillId, name: string, desc: string, icon: any, iconUuid: string): DefChestSkillOption => ({
            id, role, tier, name, desc, icon: icon || undefined, iconUuid,
        });

        if (role === DefChestHeroRole.PALADIN) {
            return tier === DefChestUpgradeTier.EPIC
                ? [
                    make(DefChestSkillId.PALADIN_THUNDER, 'Aura of Thunder', 'Lightning circles the hero, electrocuting nearby foes!', cfg?.iconPaladinThunder, '88646a82-fd26-4f3f-ae7a-a5c31fe10caf@f9941'),
                    make(DefChestSkillId.PALADIN_SUN, 'Aura of Sun', 'Radiates solar heat, scorching all nearby enemies!', cfg?.iconPaladinSun, '9ce2e32d-c186-47a2-860a-57fa0d4d562d@f9941'),
                    make(DefChestSkillId.PALADIN_PROTECTIVE, 'Protective Aura', 'Holy barrier shields allies and mends squad wounds!', cfg?.iconPaladinProtective, '86bfb44b-a965-4fdc-ade4-4388fdf2f252@f9941'),
                ]
                : [
                    make(DefChestSkillId.PALADIN_BONK, 'Bonk', 'Heavy sacred slam crushes foes with golden shockwaves!', cfg?.iconPaladinBonk, 'a27580f2-0b9a-44b7-986b-98e4108c1c00@f9941'),
                    make(DefChestSkillId.PALADIN_BURN_BURN, 'Burn Burn Burn', 'Blazing aura ignites enemies in roaring inferno flames!', cfg?.iconPaladinBurnBurnBurn, '0a6ab601-ec85-4794-a5e9-6c3f4cbcb16d@f9941'),
                    make(DefChestSkillId.PALADIN_RIGHTEOUS_FURY, 'Righteous Fury', 'Radiant holy aura expands wildly and sweeps all foes!', cfg?.iconPaladinRighteousFury, 'c36696e0-4894-4caa-b2d2-1d8fdf03f885@f9941'),
                ];
        }

        if (role === DefChestHeroRole.WARRIOR) {
            return tier === DefChestUpgradeTier.EPIC
                ? [
                    make(DefChestSkillId.WARRIOR_ATTACK_CONE, 'Whirlwind Slash', 'Spins in a fierce cyclone, cleaving all nearby foes!', cfg?.iconWarriorAttackCone, 'ba6d1060-87c0-4135-b629-4e82516214a2@f9941'),
                    make(DefChestSkillId.WARRIOR_CHARGE, 'Vanguard Charge', 'Lunges into battle, smashing through enemy lines!', cfg?.iconWarriorCharge, '3db702c6-38cd-45e9-a0a3-3705c51f49b4@f9941'),
                    make(DefChestSkillId.WARRIOR_SHELL_SHOCK, 'Shell Shock', 'Thunderous blows unleash shockwaves that stun foes!', cfg?.iconWarriorShellShock, '91c2843d-6d31-4758-8a10-401354e697f5@f9941'),
                ]
                : [
                    make(DefChestSkillId.WARRIOR_HEAVY_HAND, 'Earthshaker', 'Cataclysmic slam shatters the ground beneath foes!', cfg?.iconWarriorHeavyHand, 'e4f84a07-4dc5-4aa1-a2c6-1bc78ea7e5cf@f9941'),
                    make(DefChestSkillId.WARRIOR_BERSERKER, 'Berserker Rage', 'Unbridled fury fuels relentless, lightning-fast strikes!', cfg?.iconWarriorBerserker, '58e82a82-c2e6-4f21-824b-c6a1f699c6f0@f9941'),
                    make(DefChestSkillId.WARRIOR_SPIKES, 'Iron Spikes', 'Jagged bone spikes erupt from the earth to impale foes!', cfg?.iconWarriorSpikes, 'dfe84cdd-e59f-44fd-9cd7-3f7baeb6991a@f9941'),
                ];
        }

        return tier === DefChestUpgradeTier.EPIC
            ? [
                make(DefChestSkillId.RANGER_DOUBLE_SHOT, 'Double Shot', 'Looses twin arrows at once to rain steel on enemies!', cfg?.iconRangerDoubleShot, '2b779402-e14c-47c8-aec0-5da547eaa80c@f9941'),
                make(DefChestSkillId.RANGER_RICOCHET, 'Ricochet', 'Arrows bounce swiftly between nearby enemies!', cfg?.iconRangerRicochet, '6ff3e7bc-0a96-403a-ba32-1912a6580c2f@f9941'),
                make(DefChestSkillId.RANGER_FIRE_ARROW, 'Fire Arrow', 'Blazing arrows explode on impact and ignite foes!', cfg?.iconRangerFireArrow, '1f798a1f-2863-40be-9a9e-f83b23edaae9@f9941'),
            ]
            : [
                make(DefChestSkillId.RANGER_TRIPLE_SHOT, 'Triple Shot', 'Unleashes a deadly volley of three swift arrows!', cfg?.iconRangerTripleShot, '1e577d21-6fe0-4067-89df-2428bb8cae10@f9941'),
                make(DefChestSkillId.RANGER_SKEWER_KABOB, 'Skewer Kabob', 'Piercing arrows tear straight through enemy ranks!', cfg?.iconRangerSkewerKabob, '6293b542-fd7d-4a79-bd78-3db4c83d1421@f9941'),
                make(DefChestSkillId.RANGER_LIGHTNING_ARROW, 'Lightning Arrow', 'Storm-charged arrows arc thunder across nearby foes!', cfg?.iconRangerLightningArrow, '7278b35b-4807-45b9-bbd4-1d2f0cfdebc6@f9941'),
            ];
    }

    public static applySkillToModifiers(skillId: string, mods: DefChestHeroSkillModifiers): void {
        switch (skillId) {
            case DefChestSkillId.PALADIN_THUNDER:
                mods.hasThunderAura = true;
                mods.auraDamageMultiplier *= 1.35;
                mods.auraColor = new Color(90, 210, 255, 255);
                break;
            case DefChestSkillId.PALADIN_SUN:
                mods.hasSunAura = true;
                mods.auraRadiusMultiplier *= 1.32;
                mods.auraDamageMultiplier *= 1.45;
                mods.auraColor = new Color(255, 140, 40, 255);
                break;
            case DefChestSkillId.PALADIN_PROTECTIVE:
                mods.hasProtectiveAura = true;
                mods.damageReduction = 0.40;
                mods.auraRadiusMultiplier *= 1.2;
                mods.auraColor = new Color(255, 235, 110, 255);
                break;
            case DefChestSkillId.PALADIN_BONK:
                mods.hasBonk = true;
                mods.damageMultiplier *= 1.55;
                break;
            case DefChestSkillId.PALADIN_BURN_BURN:
                mods.hasBurnBurnBurn = true;
                mods.damageMultiplier *= 1.40;
                mods.auraDamageMultiplier *= 1.35;
                break;
            case DefChestSkillId.PALADIN_RIGHTEOUS_FURY:
                mods.hasRighteousFury = true;
                mods.auraRadiusMultiplier *= 1.45;
                mods.auraDamageMultiplier *= 1.60;
                mods.attackSpeedMultiplier *= 1.55;
                mods.damageMultiplier *= 1.40;
                break;

            case DefChestSkillId.WARRIOR_ATTACK_CONE:
                mods.weaponStage = Math.max(mods.weaponStage, 2);
                mods.isFullCircle360 = true;
                mods.damageMultiplier *= 1.35;
                break;
            case DefChestSkillId.WARRIOR_CHARGE:
                mods.weaponStage = Math.max(mods.weaponStage, 2);
                mods.hasChargeSkill = true;
                mods.damageMultiplier *= 1.35;
                mods.attackSpeedMultiplier *= 1.20;
                break;
            case DefChestSkillId.WARRIOR_SHELL_SHOCK:
                mods.weaponStage = Math.max(mods.weaponStage, 2);
                mods.hasShellShock = true;
                mods.damageMultiplier *= 1.40;
                break;
            case DefChestSkillId.WARRIOR_HEAVY_HAND:
                mods.weaponStage = 3;
                mods.hasHeavyHand = true;
                mods.damageMultiplier *= 1.65;
                break;
            case DefChestSkillId.WARRIOR_BERSERKER:
                mods.weaponStage = 3;
                mods.hasBerserker = true;
                mods.attackSpeedMultiplier *= 1.65;
                mods.damageMultiplier *= 1.35;
                break;
            case DefChestSkillId.WARRIOR_SPIKES:
                mods.weaponStage = 3;
                mods.hasSpikes = true;
                mods.damageMultiplier *= 1.50;
                break;

            case DefChestSkillId.RANGER_DOUBLE_SHOT:
                mods.arrowCount = Math.max(2, mods.arrowCount + 1);
                break;
            case DefChestSkillId.RANGER_RICOCHET:
                mods.ricochetBounces = Math.max(2, mods.ricochetBounces + 2);
                mods.damageMultiplier *= 1.20;
                break;
            case DefChestSkillId.RANGER_FIRE_ARROW:
                mods.arrowKind = DefChestArrowKind.FIRE;
                mods.damageMultiplier *= 1.30;
                break;
            case DefChestSkillId.RANGER_TRIPLE_SHOT:
                mods.arrowCount = mods.arrowCount >= 2 ? 4 : 3;
                mods.damageMultiplier *= 1.25;
                break;
            case DefChestSkillId.RANGER_SKEWER_KABOB:
                mods.pierceCount = 5;
                mods.damageMultiplier *= 1.35;
                break;
            case DefChestSkillId.RANGER_LIGHTNING_ARROW:
                mods.arrowKind = DefChestArrowKind.LIGHTNING;
                mods.damageMultiplier *= 1.45;
                break;
        }
    }
}

/** Chu kỳ 3 đòn thường + 1 đòn Special Skill cho Boss SkeletonK. */
export class EliteCycleAttackStrategy {
    private _normalCounter: number = 0;
    private readonly _normalsBeforeSkill: number;

    constructor(normalsBeforeSkill: number = 3) {
        this._normalsBeforeSkill = Math.max(1, normalsBeforeSkill);
    }

    public reset(): void {
        this._normalCounter = 0;
    }

    public nextAttackIsSpecialSkill(): boolean {
        if (this._normalCounter >= this._normalsBeforeSkill) {
            this._normalCounter = 0;
            return true;
        }
        this._normalCounter++;
        return false;
    }
}

/** Phát 1 hiệu ứng Particle tái sử dụng qua PoolManager để tránh instantiate/destroy liên tục. */
export function spawnOneShotVfx(
    prefab: Prefab | null | undefined,
    parent: Node | null | undefined,
    worldPos: Vec3,
    scale: number = 1.0,
    lifeSec: number = 1.0,
    yOffset: number = 0.25
): Node | null {
    if (!prefab || !parent || !parent.isValid) return null;

    const poolMgr = PoolManager.instance;
    const poolKey = `DefChest_VFX_${prefab.uuid}`;
    const fx = poolMgr ? poolMgr.get(poolKey, prefab, parent) : instantiate(prefab);
    if (!fx) return null;

    if (!poolMgr) fx.setParent(parent);
    fx.active = true;
    fx.setWorldPosition(worldPos.x, worldPos.y + yOffset, worldPos.z);
    fx.setScale(scale, scale, scale);

    const psList = fx.getComponentsInChildren(ParticleSystem);
    for (let i = 0; i < psList.length; i++) {
        psList[i].stop();
        psList[i].clear();
        psList[i].play();
    }

    setTimeout(() => {
        if (!fx || !fx.isValid) return;
        const pm = PoolManager.instance;
        if (pm && pm.isValid && parent && parent.isValid) {
            pm.put(poolKey, fx, parent);
        } else {
            fx.destroy();
        }
    }, Math.max(200, Math.round(lifeSec * 1000)));

    return fx;
}
