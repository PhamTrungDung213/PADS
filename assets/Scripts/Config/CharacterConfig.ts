import { _decorator, Component, CCFloat, CCInteger, CCBoolean } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CharacterConfig')
export class CharacterConfig extends Component {
    public static instance: CharacterConfig = null;

    @property({ tooltip: 'Hero bất tử (không thể chết theo GD)' })
    public isImmortal: boolean = true;

    @property({ type: CCFloat, tooltip: 'Máu tối đa của nhân vật' })
    public maxHp: number = 1000;

    @property({ type: CCFloat, tooltip: 'Tốc độ di chuyển khi kéo joystick (m/s)' })
    public moveSpeed: number = 4.0;

    @property({ type: CCFloat, tooltip: 'Tốc độ xoay hướng mặt của nhân vật' })
    public rotateSpeed: number = 10.0;

    @property({ type: CCFloat, tooltip: 'Sát thương cơ bản thực tế' })
    public baseDamage: number = 10;

    @property({ type: CCInteger, tooltip: 'Hệ số nhân hiển thị lên DamageText (x100 -> 1,000)' })
    public damageDisplayMultiplier: number = 100;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ đòn đánh chí mạng (0.25 = 25%)' })
    public critRate: number = 0.25;

    @property({ type: CCFloat, tooltip: 'Hệ số sát thương khi nổ chí mạng' })
    public critMultiplier: number = 2.0;

    @property({ type: CCFloat, tooltip: 'Tầm đánh cận chiến khi tự tìm quái (mét)' })
    public attackRange: number = 2.0;

    @property({ type: CCFloat, tooltip: 'Thời gian hồi chiêu chém thường (giây)' })
    public attackCooldown: number = 0.5;

    @property({ type: CCFloat, tooltip: 'Bán kính quét đòn đánh của Aura (mét)' })
    public auraRadius: number = 5.0;

    @property({ type: CCFloat, tooltip: 'Chu kỳ mỗi nhịp đốt máu Aura (giây)' })
    public auraTickInterval: number = 0.5;

    @property({ type: CCFloat, tooltip: 'Sát thương mỗi nhịp đốt máu Aura' })
    public auraDamage: number = 6;

    // --- LỰC ĐẨY VÀ KHOẢNG CÁCH DẠT QUÁI (CROWD SHOVING) ---
    @property({ type: CCFloat, tooltip: 'Khoảng cách / Bán kính dạt quái khi người chơi di chuyển (mét)' })
    public pushRadius: number = 1.8;

    @property({ type: CCFloat, tooltip: 'Hệ số lực đẩy dạt quái sang 2 bên khi di chuyển' })
    public pushStrength: number = 1.6;

    @property({ type: CCFloat, tooltip: 'Khoảng cách dạt giữ cự ly an toàn khi nhân vật đứng yên (mét)' })
    public personalSpace: number = 0.75;

    onLoad() {
        CharacterConfig.instance = this;
    }

    onDestroy() {
        if (CharacterConfig.instance === this) {
            CharacterConfig.instance = null;
        }
    }
}
