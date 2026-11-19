import { _decorator, Component, SpriteFrame, assetManager } from 'cc';

const { ccclass, property } = _decorator;

const GRP_ICON_PALADIN = { name: '1. Icon Skill — Paladin (6)', id: 'icon_paladin', displayOrder: 1, style: 'section' };
const GRP_ICON_WARRIOR = { name: '2. Icon Skill — Warrior (6)', id: 'icon_warrior', displayOrder: 2, style: 'section' };
const GRP_ICON_RANGER = { name: '3. Icon Skill — Ranger (6)', id: 'icon_ranger', displayOrder: 3, style: 'section' };

/**
 * DefChestIconConfig — Bảng 18 ICON SKILL (System/01_Config_ThongSo/04_Icon_Skill)
 * Đổi icon thẻ nâng cấp cho Paladin, Warrior, Ranger ngay tại đây.
 */
@ccclass('DefChestIconConfig')
export class DefChestIconConfig extends Component {
    // --- PALADIN SKILL ICONS (6) ---
    @property({ group: GRP_ICON_PALADIN, type: SpriteFrame, tooltip: '[Paladin - Epic 1] Icon Aura of Thunder' })
    public iconPaladinThunder: SpriteFrame = null;

    @property({ group: GRP_ICON_PALADIN, type: SpriteFrame, tooltip: '[Paladin - Epic 2] Icon Aura of Sun' })
    public iconPaladinSun: SpriteFrame = null;

    @property({ group: GRP_ICON_PALADIN, type: SpriteFrame, tooltip: '[Paladin - Epic 3] Icon Protective Aura' })
    public iconPaladinProtective: SpriteFrame = null;

    @property({ group: GRP_ICON_PALADIN, type: SpriteFrame, tooltip: '[Paladin - Legendary 1] Icon Bonk' })
    public iconPaladinBonk: SpriteFrame = null;

    @property({ group: GRP_ICON_PALADIN, type: SpriteFrame, tooltip: '[Paladin - Legendary 2] Icon Burn Burn Burn' })
    public iconPaladinBurnBurnBurn: SpriteFrame = null;

    @property({ group: GRP_ICON_PALADIN, type: SpriteFrame, tooltip: '[Paladin - Legendary 3] Icon Righteous Fury' })
    public iconPaladinRighteousFury: SpriteFrame = null;

    // --- WARRIOR SKILL ICONS (6) ---
    @property({ group: GRP_ICON_WARRIOR, type: SpriteFrame, tooltip: '[Warrior - Epic 1] Icon Whirlwind Slash' })
    public iconWarriorAttackCone: SpriteFrame = null;

    @property({ group: GRP_ICON_WARRIOR, type: SpriteFrame, tooltip: '[Warrior - Epic 2] Icon Vanguard Charge' })
    public iconWarriorCharge: SpriteFrame = null;

    @property({ group: GRP_ICON_WARRIOR, type: SpriteFrame, tooltip: '[Warrior - Epic 3] Icon Shell Shock' })
    public iconWarriorShellShock: SpriteFrame = null;

    @property({ group: GRP_ICON_WARRIOR, type: SpriteFrame, tooltip: '[Warrior - Legendary 1] Icon Earthshaker' })
    public iconWarriorHeavyHand: SpriteFrame = null;

    @property({ group: GRP_ICON_WARRIOR, type: SpriteFrame, tooltip: '[Warrior - Legendary 2] Icon Berserker Rage' })
    public iconWarriorBerserker: SpriteFrame = null;

    @property({ group: GRP_ICON_WARRIOR, type: SpriteFrame, tooltip: '[Warrior - Legendary 3] Icon Iron Spikes' })
    public iconWarriorSpikes: SpriteFrame = null;

    // --- RANGER SKILL ICONS (6) ---
    @property({ group: GRP_ICON_RANGER, type: SpriteFrame, tooltip: '[Ranger - Epic 1] Icon Double Shot' })
    public iconRangerDoubleShot: SpriteFrame = null;

    @property({ group: GRP_ICON_RANGER, type: SpriteFrame, tooltip: '[Ranger - Epic 2] Icon Ricochet' })
    public iconRangerRicochet: SpriteFrame = null;

    @property({ group: GRP_ICON_RANGER, type: SpriteFrame, tooltip: '[Ranger - Epic 3] Icon Fire Arrow' })
    public iconRangerFireArrow: SpriteFrame = null;

    @property({ group: GRP_ICON_RANGER, type: SpriteFrame, tooltip: '[Ranger - Legendary 1] Icon Triple Shot' })
    public iconRangerTripleShot: SpriteFrame = null;

    @property({ group: GRP_ICON_RANGER, type: SpriteFrame, tooltip: '[Ranger - Legendary 2] Icon Skewer Kabob' })
    public iconRangerSkewerKabob: SpriteFrame = null;

    @property({ group: GRP_ICON_RANGER, type: SpriteFrame, tooltip: '[Ranger - Legendary 3] Icon Lightning Arrow' })
    public iconRangerLightningArrow: SpriteFrame = null;

    public preloadFallbackIcons(): void {
        const loadSf = (uuid: string, assign: (sf: SpriteFrame) => void, current: SpriteFrame) => {
            if (current) return;
            assetManager.loadAny(uuid, (err, asset: SpriteFrame) => {
                if (!err && asset) assign(asset);
            });
        };

        // Paladin
        loadSf('88646a82-fd26-4f3f-ae7a-a5c31fe10caf@f9941', s => { if (!this.iconPaladinThunder) this.iconPaladinThunder = s; }, this.iconPaladinThunder);
        loadSf('9ce2e32d-c186-47a2-860a-57fa0d4d562d@f9941', s => { if (!this.iconPaladinSun) this.iconPaladinSun = s; }, this.iconPaladinSun);
        loadSf('86bfb44b-a965-4fdc-ade4-4388fdf2f252@f9941', s => { if (!this.iconPaladinProtective) this.iconPaladinProtective = s; }, this.iconPaladinProtective);
        loadSf('a27580f2-0b9a-44b7-986b-98e4108c1c00@f9941', s => { if (!this.iconPaladinBonk) this.iconPaladinBonk = s; }, this.iconPaladinBonk);
        loadSf('0a6ab601-ec85-4794-a5e9-6c3f4cbcb16d@f9941', s => { if (!this.iconPaladinBurnBurnBurn) this.iconPaladinBurnBurnBurn = s; }, this.iconPaladinBurnBurnBurn);
        loadSf('c36696e0-4894-4caa-b2d2-1d8fdf03f885@f9941', s => { if (!this.iconPaladinRighteousFury) this.iconPaladinRighteousFury = s; }, this.iconPaladinRighteousFury);

        // Warrior
        loadSf('ba6d1060-87c0-4135-b629-4e82516214a2@f9941', s => { if (!this.iconWarriorAttackCone) this.iconWarriorAttackCone = s; }, this.iconWarriorAttackCone);
        loadSf('3db702c6-38cd-45e9-a0a3-3705c51f49b4@f9941', s => { if (!this.iconWarriorCharge) this.iconWarriorCharge = s; }, this.iconWarriorCharge);
        loadSf('91c2843d-6d31-4758-8a10-401354e697f5@f9941', s => { if (!this.iconWarriorShellShock) this.iconWarriorShellShock = s; }, this.iconWarriorShellShock);
        loadSf('e4f84a07-4dc5-4aa1-a2c6-1bc78ea7e5cf@f9941', s => { if (!this.iconWarriorHeavyHand) this.iconWarriorHeavyHand = s; }, this.iconWarriorHeavyHand);
        loadSf('58e82a82-c2e6-4f21-824b-c6a1f699c6f0@f9941', s => { if (!this.iconWarriorBerserker) this.iconWarriorBerserker = s; }, this.iconWarriorBerserker);
        loadSf('dfe84cdd-e59f-44fd-9cd7-3f7baeb6991a@f9941', s => { if (!this.iconWarriorSpikes) this.iconWarriorSpikes = s; }, this.iconWarriorSpikes);

        // Ranger
        loadSf('2b779402-e14c-47c8-aec0-5da547eaa80c@f9941', s => { if (!this.iconRangerDoubleShot) this.iconRangerDoubleShot = s; }, this.iconRangerDoubleShot);
        loadSf('6ff3e7bc-0a96-403a-ba32-1912a6580c2f@f9941', s => { if (!this.iconRangerRicochet) this.iconRangerRicochet = s; }, this.iconRangerRicochet);
        loadSf('1f798a1f-2863-40be-9a9e-f83b23edaae9@f9941', s => { if (!this.iconRangerFireArrow) this.iconRangerFireArrow = s; }, this.iconRangerFireArrow);
        loadSf('1e577d21-6fe0-4067-89df-2428bb8cae10@f9941', s => { if (!this.iconRangerTripleShot) this.iconRangerTripleShot = s; }, this.iconRangerTripleShot);
        loadSf('6293b542-fd7d-4a79-bd78-3db4c83d1421@f9941', s => { if (!this.iconRangerSkewerKabob) this.iconRangerSkewerKabob = s; }, this.iconRangerSkewerKabob);
        loadSf('7278b35b-4807-45b9-bbd4-1d2f0cfdebc6@f9941', s => { if (!this.iconRangerLightningArrow) this.iconRangerLightningArrow = s; }, this.iconRangerLightningArrow);
    }
}
