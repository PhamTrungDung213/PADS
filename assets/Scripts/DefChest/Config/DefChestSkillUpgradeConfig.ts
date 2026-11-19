import { _decorator, Component, CCFloat, SpriteFrame, assetManager } from 'cc';

const { ccclass, property } = _decorator;

const GRP_UPGRADE = { name: '1. Banner Nâng Cấp & Quay Thẻ', id: 'upgrade_ui', displayOrder: 1, style: 'section' };
const GRP_SKILL = { name: '2. Thông Số Skill & Chí Mạng', id: 'skill_stats', displayOrder: 2, style: 'section' };

/**
 * DefChestSkillUpgradeConfig — Bảng thông số NÂNG CẤP & SKILL (System/01_Config_ThongSo/03_NangCap_Skill)
 */
@ccclass('DefChestSkillUpgradeConfig')
export class DefChestSkillUpgradeConfig extends Component {
    // --- 1. BANNER NÂNG CẤP & QUAY THẺ ---
    @property({ group: GRP_UPGRADE, type: SpriteFrame, tooltip: '[Đợt nâng cấp 1 - Sau Wave 1] Ảnh nền thẻ Tím (Epic - skill_Purple.png)' })
    public purpleBannerFrame: SpriteFrame = null;

    @property({ group: GRP_UPGRADE, type: SpriteFrame, tooltip: '[Đợt nâng cấp 2 - Sau Wave 2] Ảnh nền thẻ Vàng (Legendary - skill_Gold.png)' })
    public goldBannerFrame: SpriteFrame = null;

    @property({ group: GRP_UPGRADE, type: CCFloat, tooltip: 'Thời gian quay thẻ dự phòng nếu không gắn clip âm thanh (giây)' })
    public fastCardSpinDuration: number = 0.48;

    @property({ group: GRP_UPGRADE, type: CCFloat, tooltip: 'Tỉ lệ hồi máu cho các Hero còn sống sau mỗi đợt nâng cấp Skill (0.45 = 45%)' })
    public upgradeHealRatio: number = 0.45;

    // --- 2. THÔNG SỐ SKILL & CHÍ MẠNG ---
    @property({ group: GRP_SKILL, type: CCFloat, tooltip: 'Tỉ lệ chí mạng chung của đội hình (0.25 = 25%)' })
    public critRate: number = 0.25;

    @property({ group: GRP_SKILL, type: CCFloat, tooltip: 'Hệ số nhân sát thương chí mạng (2.0 = x2)' })
    public critMultiplier: number = 2.0;

    @property({ group: GRP_SKILL, type: CCFloat, tooltip: '[Skill Paladin] Bán kính vòng Aura cơ sở (m)' })
    public paladinAuraRadius: number = 3.6;

    @property({ group: GRP_SKILL, type: CCFloat, tooltip: '[Skill Paladin] Sát thương mỗi nhịp Aura cơ sở' })
    public paladinAuraDamage: number = 12;

    public preloadFallbackBanners(): void {
        const loadSf = (uuid: string, assign: (sf: SpriteFrame) => void, current: SpriteFrame) => {
            if (current) return;
            assetManager.loadAny(uuid, (err, asset: SpriteFrame) => {
                if (!err && asset) assign(asset);
            });
        };
        loadSf('c82301fa-4b8a-4952-b184-e437c95a25f1@f9941', s => { if (!this.purpleBannerFrame) this.purpleBannerFrame = s; }, this.purpleBannerFrame);
        loadSf('d974128b-5c9b-4a63-c295-f548da6b36a2@f9941', s => { if (!this.goldBannerFrame) this.goldBannerFrame = s; }, this.goldBannerFrame);
    }
}
