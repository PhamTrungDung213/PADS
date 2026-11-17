import { _decorator, Component, CCInteger, SpriteFrame, assetManager } from 'cc';
const { ccclass, property } = _decorator;

export interface SkillData {
    id: string;
    name: string;
    desc: string;
    level: number;
    colorHex: string;
    icon?: SpriteFrame;
    iconUuid?: string;
}

@ccclass('LevelUpConfig')
export class LevelUpConfig extends Component {
    public static instance: LevelUpConfig = null;

    @property({ type: CCInteger, tooltip: 'Kills required to trigger Popup 1 (Default: 2 per GD)' })
    public step1Kills: number = 2;

    @property({ type: CCInteger, tooltip: 'Additional kills to trigger Popup 2 (Default: 5 per GD)' })
    public step2Kills: number = 5;

    @property({ type: CCInteger, tooltip: 'Additional kills to trigger Popup 3 (Default: 5 per GD)' })
    public step3Kills: number = 5;

    // --- Kéo thả Icon trực tiếp trong Cocos Creator Inspector ---
    @property({ type: SpriteFrame, tooltip: 'Icon cho Aura of Thunder (Level 1)' })
    public iconThunder: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Icon cho Aura of Sun (Level 1)' })
    public iconSun: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Icon cho Protective Aura (Level 1)' })
    public iconProtective: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Icon cho Bonk (Level 2)' })
    public iconBonk: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Icon cho Burn Burn Burn (Level 2)' })
    public iconBurn: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Icon cho Righteous Fury (Level 2)' })
    public iconRighteousFury: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Icon cho Holy Retribution (Level 3)' })
    public iconHolyRetribution: SpriteFrame = null;

    // Paladin skills progression across 3 level-up tiers
    public level1Skills: SkillData[] = [
        {
            id: 'aura_thunder',
            name: 'Aura of Thunder',
            desc: 'Lightning circles the hero, electrocuting nearby enemies!',
            level: 1,
            colorHex: '#4CAF50',
            iconUuid: '88646a82-fd26-4f3f-ae7a-a5c31fe10caf@f9941',
        },
        {
            id: 'aura_sun',
            name: 'Aura of Sun',
            desc: 'Radiates solar heat, burning all nearby enemies!',
            level: 1,
            colorHex: '#4CAF50',
            iconUuid: '9ce2e32d-c186-47a2-860a-57fa0d4d562d@f9941',
        },
        {
            id: 'aura_protective',
            name: 'Protective Aura',
            desc: 'Holy barrier knocks back and slows nearby enemies!',
            level: 1,
            colorHex: '#4CAF50',
            iconUuid: '86bfb44b-a965-4fdc-ade4-4388fdf2f252@f9941',
        },
    ];

    public level2Skills: SkillData[] = [
        {
            id: 'bonk_stun',
            name: 'Bonk',
            desc: 'Heavy strike stuns enemy clusters for 1.5 seconds!',
            level: 2,
            colorHex: '#9C27B0',
            iconUuid: 'a27580f2-0b9a-44b7-986b-98e4108c1c00@f9941',
        },
        {
            id: 'burn_burn_burn',
            name: 'Burn Burn Burn',
            desc: 'Blazing aura ignites foes, doubling burn damage!',
            level: 2,
            colorHex: '#9C27B0',
            iconUuid: '0a6ab601-ec85-4794-a5e9-6c3f4cbcb16d@f9941',
        },
        {
            id: 'righteous_fury',
            name: 'Righteous Fury',
            desc: 'Doubles aura radius, sweeping enemies from afar!',
            level: 2,
            colorHex: '#9C27B0',
            iconUuid: 'c36696e0-4894-4caa-b2d2-1d8fdf03f885@f9941',
        },
    ];

    public level3Skills: SkillData[] = [
        {
            id: 'holy_screen_clear',
            name: 'Holy Retribution',
            desc: 'Calls down a divine light pillar, obliterating all enemies!',
            level: 3,
            colorHex: '#FFD700',
            iconUuid: 'e9ea7eb0-1ac0-4183-98e6-0dd16e4ce237@f9941',
        },
    ];

    onLoad() {
        LevelUpConfig.instance = this;
        this.applyInspectorIcons();
        this.preloadSkillIcons();
    }

    /**
     * Đồng bộ các icon được bạn kéo thả trực tiếp trong Inspector vào dữ liệu kỹ năng
     */
    public applyInspectorIcons() {
        if (this.iconThunder && this.level1Skills[0]) this.level1Skills[0].icon = this.iconThunder;
        if (this.iconSun && this.level1Skills[1]) this.level1Skills[1].icon = this.iconSun;
        if (this.iconProtective && this.level1Skills[2]) this.level1Skills[2].icon = this.iconProtective;

        if (this.iconBonk && this.level2Skills[0]) this.level2Skills[0].icon = this.iconBonk;
        if (this.iconBurn && this.level2Skills[1]) this.level2Skills[1].icon = this.iconBurn;
        if (this.iconRighteousFury && this.level2Skills[2]) this.level2Skills[2].icon = this.iconRighteousFury;

        if (this.iconHolyRetribution && this.level3Skills[0]) this.level3Skills[0].icon = this.iconHolyRetribution;
    }

    public preloadSkillIcons() {
        this.applyInspectorIcons();
        const list = [...this.level1Skills, ...this.level2Skills, ...this.level3Skills];
        for (const sk of list) {
            if (sk.iconUuid && !sk.icon) {
                assetManager.loadAny(sk.iconUuid, (err, asset: SpriteFrame) => {
                    if (!err && asset && !sk.icon) {
                        sk.icon = asset;
                    }
                });
            }
        }
    }

    onDestroy() {
        if (LevelUpConfig.instance === this) {
            LevelUpConfig.instance = null;
        }
    }
}
