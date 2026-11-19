import { _decorator, Component, CCFloat, CCInteger } from 'cc';

const { ccclass, property } = _decorator;

const GRP_WAVE = { name: '1. Lịch Trình 3 Đợt Quái (Wave 1 / 2 / 3)', id: 'world_wave', displayOrder: 1, style: 'section' };
const GRP_CHEST = { name: '2. Rương Kho Báu & Vàng Chiến Thắng', id: 'world_chest', displayOrder: 2, style: 'section' };
const GRP_CAMERA = { name: '3. Camera Động & Góc Nhìn (FOV)', id: 'world_cam', displayOrder: 3, style: 'section' };

/**
 * DefChestWorldConfig — Bảng thông số WAVE, RƯƠNG & CAMERA (System/01_Config_ThongSo/05_Wave_Ruong_Map)
 */
@ccclass('DefChestWorldConfig')
export class DefChestWorldConfig extends Component {
    // --- 1. LỊCH TRÌNH 3 ĐỢT QUÁI ---
    @property({ group: GRP_WAVE, type: CCInteger, tooltip: '[Wave 1] Số quái cơ bản spawn từ 1 hướng ngẫu nhiên' })
    public wave1BasicCount: number = 5;

    @property({ group: GRP_WAVE, type: CCInteger, tooltip: '[Wave 2] Số hướng ngẫu nhiên (Mặc định: 2 hướng)' })
    public wave2DirectionCount: number = 2;

    @property({ group: GRP_WAVE, type: CCInteger, tooltip: '[Wave 2] Số quái cơ bản mỗi hướng (2 hướng x 5 = 10 quái)' })
    public wave2BasicPerDirection: number = 5;

    @property({ group: GRP_WAVE, type: CCInteger, tooltip: '[Last Wave] Số Boss SkeletonK từ 1 hướng ngẫu nhiên' })
    public wave3EliteCount: number = 1;

    @property({ group: GRP_WAVE, type: CCInteger, tooltip: '[Last Wave] Số quái cơ bản mỗi hướng trên cả 3 hướng (3 hướng x 5 = 15 quái)' })
    public wave3BasicPerDirection: number = 5;

    @property({ group: GRP_WAVE, type: CCFloat, tooltip: 'Khoảng cách thời gian giữa mỗi con quái xuất hiện trong cùng 1 điểm spawn (giây)' })
    public spawnStaggerInterval: number = 0.42;

    // --- 2. RƯƠNG KHO BÁU & VÀNG CHIẾN THẮNG ---
    @property({ group: GRP_CHEST, type: CCFloat, tooltip: 'Lượng kho báu tối đa trong Rương (100 = 100%)' })
    public maxTreasure: number = 100.0;

    @property({ group: GRP_CHEST, type: CCFloat, tooltip: 'Khoảng cách từ tâm Rương mà Địch bắt đầu ưu tiên đánh Rương kệ Hero (m)' })
    public chestPriorityRadius: number = 2.85;

    @property({ group: GRP_CHEST, type: CCFloat, tooltip: 'Khoảng cách Địch dừng lại đứng cướp/đập Rương (m)' })
    public chestStealStopRadius: number = 1.95;

    @property({ group: GRP_CHEST, type: CCInteger, tooltip: 'Số lượng Vàng tối đa spawn khi Thắng (xoay vòng liên tục)' })
    public winMaxGoldPoolCount: number = 20;

    @property({ group: GRP_CHEST, type: CCFloat, tooltip: 'Khoảng cách thời gian giữa mỗi cục vàng văng ra từ rương khi Thắng (giây)' })
    public winGoldSpawnInterval: number = 0.12;

    // --- 3. CAMERA ĐỘNG & FOV ---
    @property({ group: GRP_CAMERA, type: CCFloat, tooltip: 'Tốc độ bám theo tâm đội hình của Camera' })
    public camFollowSpeed: number = 8.5;

    @property({ group: GRP_CAMERA, type: CCFloat, tooltip: 'Góc FOV cơ bản của Camera (45 độ)' })
    public baseFov: number = 45.0;

    @property({ group: GRP_CAMERA, type: CCFloat, tooltip: 'Góc FOV tối đa khi 3 nhân vật cách xa nhau ngoài phạm vi cam' })
    public maxFov: number = 68.0;

    @property({ group: GRP_CAMERA, type: CCFloat, tooltip: 'Ngưỡng biên màn hình chuẩn hóa (0..0.5) bắt đầu mở rộng FOV' })
    public viewportSafeMargin: number = 0.33;

    @property({ group: GRP_CAMERA, type: CCFloat, tooltip: 'Khoảng cách xa nhau giữa các Hero bắt đầu mở rộng FOV (m)' })
    public heroSpreadThreshold: number = 3.2;

    @property({ group: GRP_CAMERA, type: CCFloat, tooltip: 'Hệ số độ nhạy mở rộng FOV theo khoảng cách tách đội hình' })
    public fovExpandGain: number = 4.2;

    @property({ group: GRP_CAMERA, type: CCFloat, tooltip: 'Tốc độ nội suy thay đổi FOV mượt mà' })
    public fovSmoothSpeed: number = 6.0;
}
