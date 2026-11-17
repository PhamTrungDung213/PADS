import { _decorator, Component, Node, Vec3, CCInteger, CCFloat } from 'cc';
import { EnemyPool } from './EnemyPool';
import { SpawnerConfig } from '../Config/SpawnerConfig';
import { GameManager, GameFlowState } from '../System/GameManager';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

@ccclass('EnemiesSpawner')
export class EnemiesSpawner extends Component {
    @property({ type: [Node], tooltip: 'Danh sách các điểm spawn quái cố định (4 lối đi đất)' })
    public spawnPoints: Node[] = [];

    @property({ type: CCInteger, tooltip: 'Số lượng quái tối đa trên màn hình' })
    public maxEnemies: number = 30;

    @property({ type: CCInteger, tooltip: 'Số lượng quái ban đầu' })
    public initialEnemyCount: number = 3;

    @property({ type: CCFloat, tooltip: 'Khoảng cách giữa các lượt sinh quái (giây - có thể chỉnh trực tiếp trên Inspector)' })
    public spawnInterval: number = 0.5;

    @property({ type: CCFloat, tooltip: 'Bán kính sinh quái tản đều xung quanh điểm spawn (m)' })
    public spawnRadius: number = 4.0;

    private _timer: number = 0;
    private _isStopped: boolean = false;
    private _spawnPos: Vec3 = new Vec3();
    private _heroPos: Vec3 = new Vec3();
    private _currentIndex: number = 0;
    private _pendingInitialSpawns: number = 0;
    private _staggerTimer: number = 0;

    onLoad() {
        this.applyConfig();

        // Tự động lấy các node con nếu danh sách spawnPoints chưa được kéo
        if (this.spawnPoints.length === 0 && this.node.children.length > 0) {
            this.spawnPoints = [...this.node.children];
        }

        EventManager.instance.on(GameEvent.SCREEN_CLEAR, this.onScreenClear, this);
    }

    public applyConfig() {
        const config = SpawnerConfig.instance;
        if (config) {
            if (config.maxEnemiesOnScreen > 0) this.maxEnemies = config.maxEnemiesOnScreen;
            if (config.initialEnemyCount > 0) this.initialEnemyCount = config.initialEnemyCount;
            if (config.spawnInterval > 0) this.spawnInterval = config.spawnInterval;
            if (config.spawnRadius !== undefined && config.spawnRadius >= 0) this.spawnRadius = config.spawnRadius;
        }
    }

    onDestroy() {
        EventManager.instance.off(GameEvent.SCREEN_CLEAR, this.onScreenClear, this);
    }

    start() {
        this.applyConfig();
        // Ban đầu sinh số lượng quái so le để loại bỏ hoàn toàn cú khựng ở giây 0.2
        this.scheduleOnce(() => {
            const minEnemies = SpawnerConfig.instance ? SpawnerConfig.instance.minEnemiesOnScreen : 0;
            const countToSpawn = Math.max(this.initialEnemyCount, minEnemies > 0 ? Math.min(minEnemies, this.maxEnemies) : 10);
            this.initialSpawn(countToSpawn);
        }, 0.1);
    }

    private initialSpawn(count: number) {
        // Sinh ngay 2 con đầu tiên để người chơi nhìn thấy quái ngay từ đầu
        const immediate = Math.min(2, count);
        for (let i = 0; i < immediate; i++) {
            this.spawnOneEnemy();
        }
        // Phân bổ các con còn lại so le mỗi 0.05s (khoảng 3 frames ở 60 FPS)
        this._pendingInitialSpawns = count - immediate;
        this._staggerTimer = 0;
    }

    update(deltaTime: number) {
        if (this._isStopped) return;
        if (GameManager.instance && GameManager.instance.isPaused) return;

        // Ưu tiên hoàn tất đợt quái ban đầu một cách mượt mà (staggered)
        if (this._pendingInitialSpawns > 0) {
            this._staggerTimer += deltaTime;
            if (this._staggerTimer >= 0.05) {
                this._staggerTimer = 0;
                this.spawnOneEnemy();
                this._pendingInitialSpawns--;
            }
            return;
        }

        this.applyConfig();
        this._timer += deltaTime;

        let currentInterval = this.spawnInterval;
        let currentMax = this.maxEnemies;

        // Nếu số lượng quái trên sân ít hơn minEnemies (ví dụ dưới 20), tăng tốc sinh quái dồn dập để lấp đầy số quái mong muốn
        const minEnemies = SpawnerConfig.instance ? SpawnerConfig.instance.minEnemiesOnScreen : 0;
        const currentCount = EnemyPool.instance ? EnemyPool.instance.getActiveCount() : 0;

        if (minEnemies > 0 && currentCount < minEnemies) {
            currentInterval = Math.min(currentInterval * 0.3, 0.1);
        }

        if (this._timer >= currentInterval) {
            this._timer = 0;
            if (EnemyPool.instance && currentCount < currentMax) {
                this.spawnOneEnemy();
            }
        }
    }

    private getHeroPosition(): Vec3 {
        const hero = (GameManager.instance && GameManager.instance.playerNode)
            || this.node.scene?.getChildByName('Character');
        if (hero && hero.isValid) {
            hero.getWorldPosition(this._heroPos);
        } else {
            this._heroPos.set(0, 0, 0);
        }
        return this._heroPos;
    }

    private spawnOneEnemy() {
        if (!EnemyPool.instance) return;

        let originX = 0;
        let originY = 0;
        let originZ = 0;

        // 1. Xác định vị trí gốc của điểm spawn
        if (this.spawnPoints.length > 0) {
            const point = this.spawnPoints[this._currentIndex % this.spawnPoints.length];
            this._currentIndex++;
            if (point && point.isValid) {
                point.getWorldPosition(this._spawnPos);
                originX = this._spawnPos.x;
                originY = this._spawnPos.y;
                originZ = this._spawnPos.z;
            } else {
                const heroPos = this.getHeroPosition();
                originX = heroPos.x;
                originY = heroPos.y;
                originZ = heroPos.z;
            }
        } else {
            const heroPos = this.getHeroPosition();
            originX = heroPos.x;
            originY = heroPos.y;
            originZ = heroPos.z;
        }

        // 2. Tính toán độ tản ngẫu nhiên xung quanh điểm spawn theo bán kính spawnRadius
        const config = SpawnerConfig.instance;
        const radius = (config && config.spawnRadius !== undefined && config.spawnRadius >= 0)
            ? config.spawnRadius
            : this.spawnRadius;

        if (radius > 0) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius; // Phân bổ đều trên diện tích hình tròn
            this._spawnPos.set(
                originX + Math.cos(angle) * r,
                originY,
                originZ + Math.sin(angle) * r,
            );
        } else {
            this._spawnPos.set(originX, originY, originZ);
        }

        EnemyPool.instance.spawn(this._spawnPos);
    }

    private onScreenClear() {
        this._isStopped = true;
        this._pendingInitialSpawns = 0;
    }
}
