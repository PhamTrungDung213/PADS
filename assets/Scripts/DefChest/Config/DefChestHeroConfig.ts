import { _decorator, Component, CCFloat } from 'cc';

const { ccclass, property } = _decorator;

const GRP_SQUAD = { name: '1. Đội Hình & Di Chuyển Chung', id: 'squad', displayOrder: 1, style: 'section' };
const GRP_PALADIN = { name: '2. Hero 1 — Paladin (Đỡ đòn & Aura)', id: 'paladin', displayOrder: 2, style: 'section' };
const GRP_WARRIOR = { name: '3. Hero 2 — Warrior (Cận chiến & Đổi rìu)', id: 'warrior', displayOrder: 3, style: 'section' };
const GRP_RANGER = { name: '4. Hero 3 — Ranger (Cung thủ tầm xa)', id: 'ranger', displayOrder: 4, style: 'section' };

/**
 * DefChestHeroConfig — Bảng thông số PHE TA (System/01_Config_ThongSo/01_Ta_Hero)
 */
@ccclass('DefChestHeroConfig')
export class DefChestHeroConfig extends Component {
    // --- 1. ĐỘI HÌNH & DI CHUYỂN CHUNG ---
    @property({ group: GRP_SQUAD, type: CCFloat, tooltip: 'Tốc độ di chuyển của đội hình 3 nhân vật (m/s)' })
    public squadMoveSpeed: number = 4.6;

    @property({ group: GRP_SQUAD, type: CCFloat, tooltip: 'Tốc độ bám vị trí đội hình tam giác của từng Hero' })
    public formationFollowSpeed: number = 10.5;

    @property({ group: GRP_SQUAD, type: CCFloat, tooltip: 'Tốc độ xoay hướng mặt của Hero' })
    public heroRotateSpeed: number = 16.0;

    @property({ group: GRP_SQUAD, type: CCFloat, tooltip: 'Lề an toàn mép bờ đảo cho Hero (m)' })
    public heroShoreInset: number = 0.55;

    @property({ group: GRP_SQUAD, type: CCFloat, tooltip: 'Bán kính va chạm của Hero với vật cản nội khu (m)' })
    public heroCollisionRadius: number = 0.45;

    // --- 2. PALADIN ---
    @property({ group: GRP_PALADIN, type: CCFloat, tooltip: '[Paladin] Máu tối đa' })
    public paladinMaxHp: number = 420;

    @property({ group: GRP_PALADIN, type: CCFloat, tooltip: '[Paladin] Sát thương đập sách cơ bản' })
    public paladinBaseDamage: number = 22;

    @property({ group: GRP_PALADIN, type: CCFloat, tooltip: '[Paladin] Tầm đánh cận chiến (m)' })
    public paladinAttackRange: number = 2.15;

    @property({ group: GRP_PALADIN, type: CCFloat, tooltip: '[Paladin] Hồi chiêu đánh thường (giây)' })
    public paladinAttackCooldown: number = 0.58;

    // --- 3. WARRIOR ---
    @property({ group: GRP_WARRIOR, type: CCFloat, tooltip: '[Warrior] Máu tối đa' })
    public warriorMaxHp: number = 450;

    @property({ group: GRP_WARRIOR, type: CCFloat, tooltip: '[Warrior] Sát thương khởi đầu (Dagger)' })
    public warriorStage1Damage: number = 20;

    @property({ group: GRP_WARRIOR, type: CCFloat, tooltip: '[Warrior] Sát thương sau Wave 1 (Rìu 1 tay axe_Tier2)' })
    public warriorStage2Damage: number = 38;

    @property({ group: GRP_WARRIOR, type: CCFloat, tooltip: '[Warrior] Sát thương sau Wave 2 (Rìu 2 tay two_handed_axe_Tier2)' })
    public warriorStage3Damage: number = 68;

    @property({ group: GRP_WARRIOR, type: CCFloat, tooltip: '[Warrior] Tầm đánh cận chiến cơ bản (m)' })
    public warriorAttackRange: number = 2.0;

    @property({ group: GRP_WARRIOR, type: CCFloat, tooltip: '[Warrior] Hồi chiêu đánh cơ bản (giây)' })
    public warriorAttackCooldown: number = 0.50;

    // --- 4. RANGER ---
    @property({ group: GRP_RANGER, type: CCFloat, tooltip: '[Ranger] Máu tối đa' })
    public rangerMaxHp: number = 340;

    @property({ group: GRP_RANGER, type: CCFloat, tooltip: '[Ranger] Sát thương mỗi mũi tên cơ bản' })
    public rangerBaseDamage: number = 24;

    @property({ group: GRP_RANGER, type: CCFloat, tooltip: '[Ranger] Tầm bắn cung (m)' })
    public rangerAttackRange: number = 5.2;

    @property({ group: GRP_RANGER, type: CCFloat, tooltip: '[Ranger] Hồi chiêu bắn cung (giây)' })
    public rangerAttackCooldown: number = 0.62;

    @property({ group: GRP_RANGER, type: CCFloat, tooltip: '[Ranger] Tốc độ bay của mũi tên (m/s)' })
    public arrowSpeed: number = 13.5;
}
