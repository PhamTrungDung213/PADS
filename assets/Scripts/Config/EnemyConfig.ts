import { _decorator, Component, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('EnemyConfig')
export class EnemyConfig extends Component {
    public static instance: EnemyConfig = null;

    // --- CHỈ SỐ CƠ BẢN (ENEMY STATS) ---
    @property({ type: CCFloat, tooltip: 'Máu tối đa của quái' })
    public maxHp: number = 20;

    @property({ type: CCFloat, tooltip: 'Sát thương mỗi đòn đánh của quái' })
    public damage: number = 2;

    @property({ type: CCFloat, tooltip: 'Thời gian hồi chiêu giữa các đòn đánh của quái (giây - số càng nhỏ quái đánh càng nhanh liên tục)' })
    public attackCooldown: number = 0.8;

    @property({ type: CCFloat, tooltip: 'Tốc độ hoạt ảnh chém kiếm của quái (hệ số x1.0 chuẩn, x1.5 chém nhanh, x2.0 cực nhanh)' })
    public attackAnimSpeed: number = 1.3;

    @property({ type: CCFloat, tooltip: 'Cự ly tấn công Hero của quái (m)' })
    public attackRange: number = 1.1;

    // --- DI CHUYỂN & XOAY HƯỚNG (ENEMY MOVEMENT) ---
    @property({ type: CCFloat, tooltip: 'Tốc độ di chuyển tiến vào Hero (m/s)' })
    public moveSpeed: number = 2.5;

    @property({ type: CCFloat, tooltip: 'Tốc độ xoay hướng mặt của quái' })
    public rotateSpeed: number = 10.0;

    @property({ type: CCFloat, tooltip: 'Khoảng cách dừng trước Hero (m - quái dừng ở cự ly này để chém, không đi xuyên qua Hero)' })
    public stopDistance: number = 0.75;

    @property({ type: CCFloat, tooltip: 'Khoảng cách tự cách nhau giữa các quái để bủa vây (m - bản thân quái tự cách nhau khoảng này)' })
    public separationRadius: number = 0.85;

    @property({ type: CCFloat, tooltip: 'Lực tách đàn giữa các con quái để dàn hàng bủa vây bao quanh Hero' })
    public separationForce: number = 2.0;

    onLoad() {
        EnemyConfig.instance = this;
    }

    onDestroy() {
        if (EnemyConfig.instance === this) {
            EnemyConfig.instance = null;
        }
    }
}
