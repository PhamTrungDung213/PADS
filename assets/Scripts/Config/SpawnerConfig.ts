import { _decorator, Component, CCInteger, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SpawnerConfig')
export class SpawnerConfig extends Component {
    public static instance: SpawnerConfig = null;

    @property({ type: CCInteger, tooltip: 'Số lượng quái tối đa trên màn hình' })
    public maxEnemiesOnScreen: number = 30;

    @property({ type: CCInteger, tooltip: 'Số lượng quái tối thiểu trên màn hình (luôn duy trì ít nhất từng này quái)' })
    public minEnemiesOnScreen: number = 20;

    @property({ type: CCInteger, tooltip: 'Số lượng quái sinh ra ban đầu khi vào game' })
    public initialEnemyCount: number = 20;

    @property({ type: CCFloat, tooltip: 'Khoảng cách giữa các lần sinh quái (giây)' })
    public spawnInterval: number = 0.4;

    @property({ type: CCFloat, tooltip: 'Tốc độ sinh quái ở Giai đoạn 2 (giây)' })
    public step2SpawnInterval: number = 0.3;

    @property({ type: CCFloat, tooltip: 'Bán kính sinh quái tản đều xung quanh điểm spawn (m) - tránh quái bị đè lên nhau hay xếp hàng' })
    public spawnRadius: number = 4.0;

    onLoad() {
        SpawnerConfig.instance = this;
    }

    onDestroy() {
        if (SpawnerConfig.instance === this) {
            SpawnerConfig.instance = null;
        }
    }
}
