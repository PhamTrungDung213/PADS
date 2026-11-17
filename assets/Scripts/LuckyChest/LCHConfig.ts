import { _decorator, Component, CCFloat, CCInteger, CCBoolean } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LCHConfig')
export class LCHConfig extends Component {
    public static instance: LCHConfig = null;

    // =========================================================================
    // 1. THÔNG SỐ CHUNG NGƯỜI CHƠI (WARRIOR GENERAL)
    // =========================================================================
    @property({ type: CCFloat, tooltip: 'Tốc độ di chuyển của Warrior khi kéo Joystick (m/s)' })
    public moveSpeed: number = 4.5;

    @property({ type: CCFloat, tooltip: 'Tốc độ xoay hướng mặt của Warrior' })
    public rotateSpeed: number = 16.0;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ chí mạng (0.25 = 25%)' })
    public critRate: number = 0.25;

    @property({ type: CCFloat, tooltip: 'Hệ số nhân sát thương chí mạng' })
    public critMultiplier: number = 2.0;

    @property({ type: CCInteger, tooltip: 'Hệ số nhân hiển thị số sát thương bay lên' })
    public damageDisplayMultiplier: number = 100;

    @property({ type: CCFloat, tooltip: 'Bán kính đẩy dạt quái khi Warrior di chuyển (m)' })
    public pushRadius: number = 1.6;

    @property({ type: CCFloat, tooltip: 'Lực đẩy dạt quái sang 2 bên khi di chuyển' })
    public pushStrength: number = 1.5;

    @property({ type: CCFloat, tooltip: 'Khoảng cách giữ cự ly an toàn khi đứng yên (m)' })
    public personalSpace: number = 0.75;

    // =========================================================================
    // 2. WARRIOR THEO TỪNG PHÒNG / VŨ KHÍ (DAGGER -> AXE 1 -> AXE 2)
    // =========================================================================
    @property({ type: CCFloat, tooltip: '[Phòng 1 - Dagger] Máu tối đa cố định của Warrior' })
    public p1HeroMaxHp: number = 500;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Dagger] Sát thương mỗi đòn đánh' })
    public p1HeroDamage: number = 18;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Dagger] Tầm đánh cận chiến (m)' })
    public p1HeroAttackRange: number = 1.8;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Dagger] Thời gian hồi chiêu đánh (giây)' })
    public p1HeroAttackCooldown: number = 0.48;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Dagger] Góc quét đòn đánh (độ)' })
    public p1HeroCleaveArc: number = 110;

    @property({ type: CCInteger, tooltip: '[Phòng 1 - Dagger] Số mục tiêu tối đa trúng mỗi đòn' })
    public p1HeroMaxTargets: number = 2;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - axe_Tier2 (4★)] Máu tối đa của Warrior' })
    public p2HeroMaxHp: number = 800;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - axe_Tier2 (4★)] Sát thương mỗi đòn đánh' })
    public p2HeroDamage: number = 45;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - axe_Tier2 (4★)] Tầm đánh cận chiến (m)' })
    public p2HeroAttackRange: number = 2.3;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - axe_Tier2 (4★)] Thời gian hồi chiêu đánh (giây)' })
    public p2HeroAttackCooldown: number = 0.45;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - axe_Tier2 (4★)] Góc quét đòn đánh lan (độ)' })
    public p2HeroCleaveArc: number = 145;

    @property({ type: CCInteger, tooltip: '[Phòng 2 - axe_Tier2 (4★)] Số mục tiêu tối đa trúng mỗi đòn' })
    public p2HeroMaxTargets: number = 4;

    @property({ type: CCBoolean, tooltip: '[Phòng 2] Hồi đầy máu khi nhận rìu 1' })
    public p2HealToFull: boolean = true;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - two_handed_axe_Tier2 (5★)] Máu tối đa của Warrior' })
    public p3HeroMaxHp: number = 800;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - two_handed_axe_Tier2 (5★)] Sát thương mỗi đòn đánh' })
    public p3HeroDamage: number = 90;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - two_handed_axe_Tier2 (5★)] Tầm đánh cận chiến (m)' })
    public p3HeroAttackRange: number = 2.7;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - two_handed_axe_Tier2 (5★)] Thời gian hồi chiêu đánh (giây)' })
    public p3HeroAttackCooldown: number = 0.42;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - two_handed_axe_Tier2 (5★)] Góc quét đòn đánh lan (độ)' })
    public p3HeroCleaveArc: number = 180;

    @property({ type: CCInteger, tooltip: '[Phòng 3 - two_handed_axe_Tier2 (5★)] Số mục tiêu tối đa trúng mỗi đòn' })
    public p3HeroMaxTargets: number = 6;

    @property({ type: CCBoolean, tooltip: '[Phòng 3] Hồi đầy máu khi nhận rìu 2' })
    public p3HealToFull: boolean = true;

    // =========================================================================
    // 3. THÔNG SỐ ĐỊCH PHÒNG 1 (Pos1, Pos2 - 6 con)
    // =========================================================================
    @property({ type: CCFloat, tooltip: '[Phòng 1 - Melee] Máu tối đa' })
    public p1MeleeHp: number = 65;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Melee] Sát thương mỗi đòn' })
    public p1MeleeDamage: number = 5;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Melee] Tốc độ chạy (m/s)' })
    public p1MeleeMoveSpeed: number = 2.3;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Melee] Tầm đánh (m)' })
    public p1MeleeAttackRange: number = 1.15;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Melee] Khoảng cách dừng trước Warrior (m)' })
    public p1MeleeStopDist: number = 0.85;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Melee] Hồi chiêu đánh (giây)' })
    public p1MeleeAttackCooldown: number = 0.95;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Mage] Máu tối đa' })
    public p1MageHp: number = 30;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Mage] Sát thương cầu lửa' })
    public p1MageDamage: number = 7;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Mage] Tốc độ tiến vào tầm bắn (m/s)' })
    public p1MageMoveSpeed: number = 2.0;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Mage] Tầm bắn cầu lửa (m)' })
    public p1MageAttackRange: number = 4.6;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Mage] Khoảng cách dừng bắn (không tự chạy lùi) (m)' })
    public p1MageStopDist: number = 4.2;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Mage] Hồi chiêu phóng lửa (giây)' })
    public p1MageAttackCooldown: number = 1.65;

    @property({ type: CCFloat, tooltip: '[Phòng 1 - Mage] Tốc độ bay của đạn lửa (m/s)' })
    public p1FireballSpeed: number = 7.0;

    // =========================================================================
    // 4. THÔNG SỐ ĐỊCH PHÒNG 2 (Pos3.1, Pos3.2, Pos3.3 - 12 con)
    // =========================================================================
    @property({ type: CCFloat, tooltip: '[Phòng 2 - Melee] Máu tối đa' })
    public p2MeleeHp: number = 75;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Melee] Sát thương mỗi đòn' })
    public p2MeleeDamage: number = 10;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Melee] Tốc độ chạy (m/s)' })
    public p2MeleeMoveSpeed: number = 2.6;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Melee] Tầm đánh (m)' })
    public p2MeleeAttackRange: number = 1.2;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Melee] Khoảng cách dừng trước Warrior (m)' })
    public p2MeleeStopDist: number = 0.85;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Melee] Hồi chiêu đánh (giây)' })
    public p2MeleeAttackCooldown: number = 0.85;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Mage] Máu tối đa' })
    public p2MageHp: number = 60;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Mage] Sát thương cầu lửa' })
    public p2MageDamage: number = 14;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Mage] Tốc độ tiến vào tầm bắn (m/s)' })
    public p2MageMoveSpeed: number = 2.2;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Mage] Tầm bắn cầu lửa (m)' })
    public p2MageAttackRange: number = 4.8;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Mage] Khoảng cách dừng bắn (m)' })
    public p2MageStopDist: number = 4.4;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Mage] Hồi chiêu phóng lửa (giây)' })
    public p2MageAttackCooldown: number = 1.5;

    @property({ type: CCFloat, tooltip: '[Phòng 2 - Mage] Tốc độ bay của đạn lửa (m/s)' })
    public p2FireballSpeed: number = 7.5;

    // =========================================================================
    // 5. THÔNG SỐ ĐỊCH PHÒNG 3 (18 CON TÁI SINH TẠI LASTSPAWN X2)
    // =========================================================================
    @property({ type: CCFloat, tooltip: '[Phòng 3] Hệ số Scale (X, Y, Z) của toàn bộ quái ùa ra (Mặc định: 2.0)' })
    public p3ScaleMultiplier: number = 2.0;

    @property({ type: CCFloat, tooltip: '[Phòng 3] Hệ số nhân Damage của quái Phòng 3 (Mặc định: 2.0 = x2 dame)' })
    public p3DamageMultiplier: number = 2.0;

    @property({ type: CCFloat, tooltip: '[Phòng 3] Hệ số nhân Máu của quái Phòng 3 (Mặc định: 2.0 = x2 máu)' })
    public p3HpMultiplier: number = 2.0;

    @property({ type: CCFloat, tooltip: '[Phòng 3] Hệ số nhân tốc độ chạy khi ùa vào Phòng 3' })
    public p3MoveSpeedMultiplier: number = 2.2;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - Melee cơ sở trước khi x2] Máu gốc để nhân p3HpMultiplier' })
    public p3BaseMeleeHp: number = 220;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - Melee cơ sở trước khi x2] Damage gốc để nhân p3DamageMultiplier' })
    public p3BaseMeleeDamage: number = 32;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - Mage cơ sở trước khi x2] Máu gốc để nhân p3HpMultiplier' })
    public p3BaseMageHp: number = 180;

    @property({ type: CCFloat, tooltip: '[Phòng 3 - Mage cơ sở trước khi x2] Damage gốc để nhân p3DamageMultiplier' })
    public p3BaseMageDamage: number = 38;

    // =========================================================================
    // 6. RƠI TỪ TRẦN, TÁCH ĐÀN & TƯƠNG TÁC HÒM
    // =========================================================================
    @property({ type: CCFloat, tooltip: 'Độ cao rơi từ trần xuống của quái và rương (m)' })
    public dropHeight: number = 6.5;

    @property({ type: CCFloat, tooltip: 'Thời gian rơi từ trần xuống sàn (giây)' })
    public dropDuration: number = 0.45;

    @property({ type: CCFloat, tooltip: 'Khoảng cách tách đàn giữa các quái (m)' })
    public separationRadius: number = 0.95;

    @property({ type: CCFloat, tooltip: 'Lực tách đàn giữa các quái' })
    public separationForce: number = 2.2;

    @property({ type: CCFloat, tooltip: 'Khoảng cách Warrior lại gần Hòm 1 & 2 để hiện GuideHand (m)' })
    public chestInteractRadius: number = 2.6;

    @property({ type: CCFloat, tooltip: 'Khoảng cách Warrior lại gần Hòm 3 (scale 3x) để hiện GuideHand (m)' })
    public chest3InteractRadius: number = 4.2;

    @property({ type: CCFloat, tooltip: 'Bán kính vùng nhấn mở Hòm trên màn hình UI (pixel)' })
    public chestScreenTapRadiusPx: number = 165;

    protected onLoad(): void {
        LCHConfig.instance = this;
    }

    protected onDestroy(): void {
        if (LCHConfig.instance === this) {
            LCHConfig.instance = null;
        }
    }
}
