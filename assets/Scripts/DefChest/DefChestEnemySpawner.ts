import { _decorator, Component, Node, Prefab, Material, Vec3 } from 'cc';
import {
    DefChestEnemyKind,
    IDefChestHeroTarget,
} from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { DefChestEnemyController } from './DefChestEnemyController';
import { DefChestEnemyFactory } from './DefChestFactories';

const { ccclass, property } = _decorator;

interface SpawnerTimerTask {
    remain: number;
    kind: 'spawn' | 'recycle' | 'waveClear';
    callback: () => void;
}

/**
 * DefChestEnemySpawner — Bộ sinh quái 3 giai đoạn từ 3 hướng `{Point1, Point2, Point3}`:
 * - Giai đoạn 1 (A): 5 quái cơ bản từ 1 hướng ngẫu nhiên.
 * - Giai đoạn 2 (B): 10 quái cơ bản từ 2 hướng ngẫu nhiên (mỗi hướng 5 quái).
 * - Giai đoạn 3 (C): 1 Địch tinh anh (SkeletonK) từ 1 hướng ngẫu nhiên + 15 quái cơ bản từ cả 3 hướng (mỗi hướng 5).
 * Sử dụng bộ đếm thời gian `_timers` theo `update(dt)` để không bao giờ bị kẹt/mất sự kiện chuyển Wave.
 */
@ccclass('DefChestEnemySpawner')
export class DefChestEnemySpawner extends Component {
    public static instance: DefChestEnemySpawner | null = null;

    @property({ type: [Node], tooltip: 'Danh sách 3 hướng spawn bạn đã đặt: Point1, Point2, Point3' })
    public spawnPoints: Node[] = [];

    @property({ type: Prefab, tooltip: 'Prefab Trộm cơ bản (Enemy_SkeletonMelee.prefab)' })
    public basicEnemyPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Prefab Địch tinh anh (SkeletonK.prefab)' })
    public eliteEnemyPrefab: Prefab = null;

    @property({ type: Material, tooltip: 'Material viền đỏ cho Trộm cơ bản (M_DefChest_Skeleton_OutlineRed)' })
    public outlineRedMat: Material = null;

    @property({ type: Prefab, tooltip: 'Prefab thanh máu EnemyHpBar cho Địch' })
    public enemyHpBarPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng nổ lửa Special Skill của SkeletonK' })
    public fxEliteSkillPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói khi quái chết (FX_Smoke_Die)' })
    public fxSmokeDiePrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng xương vỡ khi trúng đòn / chết (FX_common_impact_bone)' })
    public fxBoneHitPrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa Quái & VFX (System/Pool)' })
    public poolContainer: Node = null;

    private _factory: DefChestEnemyFactory | null = null;
    private _activeEnemies: DefChestEnemyController[] = [];
    private _timers: SpawnerTimerTask[] = [];
    private _dueTasksBuf: SpawnerTimerTask[] = [];
    private _pendingSpawnCount: number = 0;
    private _currentWaveIndex: number = 0;
    private _totalWaveEnemies: number = 0;
    private _killedWaveEnemies: number = 0;
    private _waveClearTriggered: boolean = false;

    private _getHeroesFn: (() => IDefChestHeroTarget[]) | null = null;
    private _onWaveClearedFn: ((waveIndex: number) => void) | null = null;
    private _onProgressFn: ((killed: number, total: number, waveIndex: number) => void) | null = null;

    protected onLoad(): void {
        DefChestEnemySpawner.instance = this;
        this.resolveSpawnPoints();
    }

    protected onDestroy(): void {
        this._timers.length = 0;
        if (this._factory) {
            this._factory.clear();
            this._factory = null;
        }
        if (DefChestEnemySpawner.instance === this) {
            DefChestEnemySpawner.instance = null;
        }
    }

    private resolveSpawnPoints(): void {
        if (!this.spawnPoints || this.spawnPoints.length === 0) {
            const p1 = this.node.getChildByName('Point1');
            const p2 = this.node.getChildByName('Point2');
            const p3 = this.node.getChildByName('Point3');
            this.spawnPoints = [p1, p2, p3].filter(Boolean) as Node[];
        }
        if (!this.poolContainer && this.node.scene) {
            this.poolContainer = this.node.scene.getChildByPath('System/Pool') || this.node;
        }
    }

    public initSpawner(params: {
        getHeroes: () => IDefChestHeroTarget[];
        onWaveCleared: (waveIndex: number) => void;
        onProgress?: (killed: number, total: number, waveIndex: number) => void;
    }): void {
        this._getHeroesFn = params.getHeroes;
        this._onWaveClearedFn = params.onWaveCleared;
        this._onProgressFn = params.onProgress || null;
        this.resolveSpawnPoints();

        if (!this._factory && this.poolContainer) {
            this._factory = new DefChestEnemyFactory({
                basicEnemyPrefab: this.basicEnemyPrefab,
                eliteEnemyPrefab: this.eliteEnemyPrefab,
                container: this.poolContainer,
                outlineRedMat: this.outlineRedMat || DefChestConfig.instance?.enemyOutlineRedMat,
                enemyHpBarPrefab: this.enemyHpBarPrefab,
                fxEliteSkillPrefab: this.fxEliteSkillPrefab,
                fxSmokeDiePrefab: this.fxSmokeDiePrefab,
                fxBoneHitPrefab: this.fxBoneHitPrefab,
            });
        }
    }

    public get activeEnemies(): DefChestEnemyController[] {
        return this._activeEnemies;
    }

    private addTimer(delay: number, kind: 'spawn' | 'recycle' | 'waveClear', callback: () => void): void {
        if (delay <= 0.001) {
            callback();
            return;
        }
        this._timers.push({ remain: delay, kind, callback });
    }

    private clearSpawnTimers(): void {
        const pendingRecycles: Array<() => void> = [];
        for (let i = 0; i < this._timers.length; i++) {
            const t = this._timers[i];
            if (t && t.kind === 'recycle') {
                pendingRecycles.push(t.callback);
            }
        }
        this._timers.length = 0;
        for (let i = 0; i < pendingRecycles.length; i++) {
            pendingRecycles[i]();
        }
    }

    public startWave1(): void {
        this.clearSpawnTimers();
        this._currentWaveIndex = 1;
        this._waveClearTriggered = false;

        const cfg = DefChestConfig.instance;
        const count = cfg ? cfg.wave1BasicCount : 5;
        const interval = cfg ? cfg.spawnStaggerInterval : 0.42;

        const chosenDirs = this.pickRandomDirections(1);
        const dirNode = chosenDirs[0];

        this._totalWaveEnemies = count;
        this._killedWaveEnemies = 0;
        this._pendingSpawnCount = count;
        this.notifyProgress();

        this.scheduleDirectionBurst(dirNode, DefChestEnemyKind.BASIC, count, interval, 0.05);
    }

    public startWave2(): void {
        this.clearSpawnTimers();
        this._currentWaveIndex = 2;
        this._waveClearTriggered = false;

        const cfg = DefChestConfig.instance;
        const dirCount = cfg ? cfg.wave2DirectionCount : 2;
        const perDir = cfg ? cfg.wave2BasicPerDirection : 5;
        const interval = cfg ? cfg.spawnStaggerInterval : 0.42;

        const chosenDirs = this.pickRandomDirections(dirCount);
        const total = chosenDirs.length * perDir;

        this._totalWaveEnemies = total;
        this._killedWaveEnemies = 0;
        this._pendingSpawnCount = total;
        this.notifyProgress();

        for (let d = 0; d < chosenDirs.length; d++) {
            this.scheduleDirectionBurst(chosenDirs[d], DefChestEnemyKind.BASIC, perDir, interval, 0.05 + d * 0.15);
        }
    }

    public startWave3(): void {
        this.clearSpawnTimers();
        this._currentWaveIndex = 3;
        this._waveClearTriggered = false;

        const cfg = DefChestConfig.instance;
        const eliteCount = cfg ? cfg.wave3EliteCount : 1;
        const perDir = cfg ? cfg.wave3BasicPerDirection : 5;
        const interval = cfg ? cfg.spawnStaggerInterval : 0.42;

        const allDirs = this.pickRandomDirections(3);
        const eliteDirs = this.pickRandomDirections(1);

        const total = eliteCount + allDirs.length * perDir;

        this._totalWaveEnemies = total;
        this._killedWaveEnemies = 0;
        this._pendingSpawnCount = total;
        this.notifyProgress();

        if (eliteDirs.length > 0 && eliteCount > 0) {
            this.scheduleDirectionBurst(eliteDirs[0], DefChestEnemyKind.ELITE, eliteCount, 0.35, 0.10);
        }
        for (let d = 0; d < allDirs.length; d++) {
            this.scheduleDirectionBurst(allDirs[d], DefChestEnemyKind.BASIC, perDir, interval, 0.22 + d * 0.12);
        }
    }

    private pickRandomDirections(count: number): Node[] {
        this.resolveSpawnPoints();
        const available = this.spawnPoints.filter(p => p && p.isValid);
        if (available.length === 0) return [this.node];

        const shuffled = available.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
        }
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    private scheduleDirectionBurst(
        dirNode: Node,
        kind: DefChestEnemyKind,
        count: number,
        interval: number,
        initialDelay: number
    ): void {
        for (let i = 0; i < count; i++) {
            const delay = initialDelay + i * interval;
            this.addTimer(delay, 'spawn', () => {
                if (!this.isValid) return;
                this.spawnSingleAtPoint(dirNode, kind, i, count);
            });
        }
    }

    public spawnSingleAtPoint(dirNode: Node, kind: DefChestEnemyKind, idxInGroup: number, groupCount: number): void {
        this._pendingSpawnCount = Math.max(0, this._pendingSpawnCount - 1);
        if (!this._factory || !dirNode || !dirNode.isValid) return;

        const basePos = dirNode.worldPosition.clone();
        const spreadAngle = (idxInGroup / Math.max(1, groupCount)) * Math.PI * 2;
        const spreadDist = kind === DefChestEnemyKind.ELITE ? 0 : 0.65 + (idxInGroup % 2) * 0.35;
        basePos.x += Math.cos(spreadAngle) * spreadDist;
        basePos.z += Math.sin(spreadAngle) * spreadDist;

        DefChestArenaBounds.instance?.resolveEnemyPosition(basePos, 0.42, true);

        const ctrl = this._factory.createEnemy(
            kind,
            basePos,
            () => (this._getHeroesFn ? this._getHeroesFn() : []),
            (deadEnemy) => this.onEnemyDied(deadEnemy)
        );

        if (ctrl) {
            this._activeEnemies.push(ctrl);
        }
    }

    private onEnemyDied(enemy: DefChestEnemyController): void {
        const idx = this._activeEnemies.indexOf(enemy);
        if (idx >= 0) {
            this._activeEnemies.splice(idx, 1);
        }
        this._killedWaveEnemies = Math.min(this._totalWaveEnemies, this._killedWaveEnemies + 1);
        this.notifyProgress();

        this.addTimer(0.65, 'recycle', () => {
            if (this._factory && enemy && enemy.isDead) {
                this._factory.recycleEnemy(enemy);
            }
        });

        this.checkWaveClearCondition();
    }

    private checkWaveClearCondition(): void {
        if (this._waveClearTriggered || this._currentWaveIndex <= 0) return;

        // Lọc bỏ các quái đã chết hoặc không còn hợp lệ
        for (let i = this._activeEnemies.length - 1; i >= 0; i--) {
            const e = this._activeEnemies[i];
            if (!e || e.isDead || !e.node || !e.node.isValid) {
                this._activeEnemies.splice(i, 1);
            }
        }

        if (this._activeEnemies.length === 0 && this._pendingSpawnCount <= 0) {
            this._waveClearTriggered = true;
            const finishedWave = this._currentWaveIndex;
            this.addTimer(0.35, 'waveClear', () => {
                this._onWaveClearedFn?.(finishedWave);
            });
        }
    }

    protected update(dt: number): void {
        if (this._timers.length > 0) {
            const dueTasks = this._dueTasksBuf;
            dueTasks.length = 0;
            for (let i = this._timers.length - 1; i >= 0; i--) {
                const task = this._timers[i];
                if (!task) continue;
                task.remain -= dt;
                if (task.remain <= 0) {
                    this._timers.splice(i, 1);
                    dueTasks.push(task);
                }
            }
            for (let i = 0; i < dueTasks.length; i++) {
                dueTasks[i].callback();
            }
            dueTasks.length = 0;
        }

        if (!this._waveClearTriggered && this._currentWaveIndex > 0 && this._pendingSpawnCount <= 0) {
            this.checkWaveClearCondition();
        }
    }

    public freezeAllEnemies(): void {
        this._timers.length = 0;
        this._pendingSpawnCount = 0;
        this._waveClearTriggered = true;
        for (let i = 0; i < this._activeEnemies.length; i++) {
            const e = this._activeEnemies[i];
            if (e && !e.isDead && e.node && e.node.isValid) {
                e.freezeAndStop();
            }
        }
    }

    public startEnemiesVictoryCelebration(): void {
        this._timers.length = 0;
        this._pendingSpawnCount = 0;
        this._waveClearTriggered = true;
        for (let i = 0; i < this._activeEnemies.length; i++) {
            const e = this._activeEnemies[i];
            if (e && !e.isDead && e.node && e.node.isValid) {
                e.startVictoryJumpLoop((i % 5) * 0.11);
            }
        }
    }

    private notifyProgress(): void {
        this._onProgressFn?.(this._killedWaveEnemies, this._totalWaveEnemies, this._currentWaveIndex);
    }
}
