import { Node, Prefab, Vec3, Color, SpriteFrame } from 'cc';

export const DEFCHEST_EVENT_TREASURE_CHANGED = 'DEFCHEST_TREASURE_CHANGED';
export const DEFCHEST_EVENT_CHEST_EMPTY = 'DEFCHEST_CHEST_EMPTY';
export const DEFCHEST_EVENT_ALL_HEROES_DEAD = 'DEFCHEST_ALL_HEROES_DEAD';
export const DEFCHEST_EVENT_PLAYER_FIRST_MOVE = 'DEFCHEST_PLAYER_FIRST_MOVE';

export enum DefChestHeroRole {
    PALADIN = 'PALADIN',
    WARRIOR = 'WARRIOR',
    RANGER = 'RANGER',
}

export enum DefChestUpgradeTier {
    EPIC = 1,      // Sau Giai đoạn A — Banner Tím
    LEGENDARY = 2, // Sau Giai đoạn B — Banner Vàng
}

export enum DefChestEnemyKind {
    BASIC = 'BASIC', // Enemy_SkeletonMelee (viền đỏ, giữ nguyên màu gốc)
    ELITE = 'ELITE', // SkeletonK (tinh anh)
}

export enum DefChestArrowKind {
    NORMAL = 0,
    FIRE = 1,
    LIGHTNING = 2,
}

export interface DefChestSkillOption {
    id: string;
    role: DefChestHeroRole;
    tier: DefChestUpgradeTier;
    name: string;
    desc: string;
    icon?: SpriteFrame;
    iconUuid: string;
}

export interface IDefChestEnemyTarget {
    readonly node: Node;
    readonly isDead: boolean;
    takeDamage(amount: number, isCrit?: boolean, knockbackDir?: Vec3, knockbackDist?: number): void;
    applyBurnDot?(dps: number, duration: number, burnPrefab?: Prefab | null): void;
}

export interface IDefChestHeroTarget {
    readonly node: Node;
    readonly isDead: boolean;
    takeDamage(amount: number, attackerNode?: Node): void;
}

export interface DefChestHeroSkillModifiers {
    damageMultiplier: number;
    attackSpeedMultiplier: number;
    damageReduction: number;

    // Paladin
    auraRadiusMultiplier: number;
    auraDamageMultiplier: number;
    auraColor: Color;
    hasThunderAura: boolean;
    hasSunAura: boolean;
    hasProtectiveAura: boolean;
    hasBonk: boolean;
    hasBurnBurnBurn: boolean;
    hasRighteousFury: boolean;

    // Warrior
    weaponStage: number; // 1 = dagger, 2 = axe_Tier2, 3 = two_handed_axe_Tier2
    isFullCircle360: boolean;
    hasChargeSkill: boolean;
    hasShellShock: boolean;
    hasHeavyHand: boolean;
    hasBerserker: boolean;
    hasSpikes: boolean;

    // Ranger
    arrowCount: number;
    spreadAngleDeg: number;
    ricochetBounces: number;
    pierceCount: number;
    arrowKind: DefChestArrowKind;
}

export function createDefaultHeroSkillModifiers(): DefChestHeroSkillModifiers {
    return {
        damageMultiplier: 1.0,
        attackSpeedMultiplier: 1.0,
        damageReduction: 0.0,

        auraRadiusMultiplier: 1.0,
        auraDamageMultiplier: 1.0,
        auraColor: new Color(255, 220, 80, 255),
        hasThunderAura: false,
        hasSunAura: false,
        hasProtectiveAura: false,
        hasBonk: false,
        hasBurnBurnBurn: false,
        hasRighteousFury: false,

        weaponStage: 1,
        isFullCircle360: false,
        hasChargeSkill: false,
        hasShellShock: false,
        hasHeavyHand: false,
        hasBerserker: false,
        hasSpikes: false,

        arrowCount: 1,
        spreadAngleDeg: 14,
        ricochetBounces: 0,
        pierceCount: 0,
        arrowKind: DefChestArrowKind.NORMAL,
    };
}
