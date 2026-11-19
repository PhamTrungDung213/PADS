import { _decorator, Component, CCFloat, Material } from 'cc';

const { ccclass, property } = _decorator;

const GRP_BASIC = { name: '1. Quái Thường — SkeletonMelee', id: 'enemy_basic', displayOrder: 1, style: 'section' };
const GRP_ELITE = { name: '2. Boss Tinh Anh — SkeletonK', id: 'enemy_elite', displayOrder: 2, style: 'section' };
const GRP_VISUAL = { name: '3. Viền Đỏ & Va Chạm Địch', id: 'enemy_visual', displayOrder: 3, style: 'section' };

/**
 * DefChestEnemyConfig — Bảng thông số PHE ĐỊCH (System/01_Config_ThongSo/02_Dich_Enemy)
 * Chỉnh máu, sát thương, kích thước (Scale) của Quái thường & Boss SkeletonK tại đây.
 */
@ccclass('DefChestEnemyConfig')
export class DefChestEnemyConfig extends Component {
    // --- 1. QUÁI THƯỜNG (SKELETON MELEE) ---
    @property({ group: GRP_BASIC, type: CCFloat, tooltip: '[Quái thường] Máu tối đa' })
    public basicEnemyHp: number = 150;

    @property({ group: GRP_BASIC, type: CCFloat, tooltip: '[Quái thường] Sát thương đánh Hero' })
    public basicEnemyDamage: number = 9;

    @property({ group: GRP_BASIC, type: CCFloat, tooltip: '[Quái thường] Kích thước mô hình (Scale)' })
    public basicEnemyScale: number = 1.18;

    @property({ group: GRP_BASIC, type: CCFloat, tooltip: '[Quái thường] Tốc độ chạy (m/s)' })
    public basicEnemyMoveSpeed: number = 2.35;

    @property({ group: GRP_BASIC, type: CCFloat, tooltip: '[Quái thường] Tốc độ cướp kho báu mỗi giây (% kho báu/s)' })
    public basicEnemyStealRate: number = 2.8;

    @property({ group: GRP_BASIC, type: CCFloat, tooltip: '[Quái thường] Bán kính phát hiện & quay sang đánh Hero trên đường đi (m)' })
    public basicEnemyAggroRadius: number = 2.6;

    // --- 2. BOSS TINH ANH (SKELETON K) ---
    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Máu tối đa' })
    public eliteEnemyHp: number = 2600;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Sát thương đòn đánh thường' })
    public eliteEnemyDamage: number = 48;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Sát thương chiêu Special Skill (đòn thứ 4)' })
    public eliteEnemySkillDamage: number = 90;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Kích thước mô hình Boss (Scale)' })
    public eliteEnemyScale: number = 2.05;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Tầm vung vũ khí cận chiến (m)' })
    public eliteEnemyAttackRange: number = 2.55;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Tốc độ chạy (m/s)' })
    public eliteEnemyMoveSpeed: number = 2.45;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Tốc độ cướp kho báu mỗi giây (% kho báu/s)' })
    public eliteEnemyStealRate: number = 9.0;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Lượng kho báu mất thêm khi tung Special Skill vào Rương (%)' })
    public eliteSkillChestBurstDrain: number = 12.0;

    @property({ group: GRP_ELITE, type: CCFloat, tooltip: '[Boss SkeletonK] Thời gian miễn aggro để chạy tiếp tới Rương sau khi đánh Hero 1 cái (giây)' })
    public eliteAdvanceAfterHitDuration: number = 1.65;

    // --- 3. VIỀN ĐỎ & VA CHẠM ĐỊCH ---
    @property({ group: GRP_VISUAL, type: CCFloat, tooltip: 'Lề an toàn mép bờ đảo cho Địch (m)' })
    public enemyShoreInset: number = 0.32;

    @property({ group: GRP_VISUAL, type: CCFloat, tooltip: 'Bán kính va chạm của Địch với vật cản nội khu (m)' })
    public enemyCollisionRadius: number = 0.42;

    @property({ group: GRP_VISUAL, type: CCFloat, tooltip: 'Độ dày viền đỏ quanh kẻ địch (0.022m)' })
    public enemyOutlineWidth: number = 0.022;

    @property({ group: GRP_VISUAL, type: Material, tooltip: 'Material viền đỏ cho Quái (M_DefChest_Skeleton_OutlineRed)' })
    public enemyOutlineRedMat: Material = null;
}
