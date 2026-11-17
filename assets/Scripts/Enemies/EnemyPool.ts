import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

@ccclass('EnemyPool')
export class EnemyPool extends Component {
    public static instance: EnemyPool = null;

    @property({ type: Prefab, tooltip: 'Prefab của quái (Enemy_SkeletonMelee.prefab)' })
    public enemyPrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Node cha chứa toàn bộ quái sinh ra' })
    public enemyContainer: Node = null;

    public activeEnemies: Node[] = [];
    private _pool: Node[] = [];
    private _tempPos: Vec3 = new Vec3();

    onLoad() {
        EnemyPool.instance = this;
        if (!this.enemyContainer) {
            this.enemyContainer = this.node;
        }
        EventManager.instance.on(GameEvent.SCREEN_CLEAR, this.killAll, this);
    }

    onDestroy() {
        if (EnemyPool.instance === this) {
            EnemyPool.instance = null;
        }
        EventManager.instance.off(GameEvent.SCREEN_CLEAR, this.killAll, this);
        this.activeEnemies.length = 0;
        this._pool.length = 0;
    }

    public spawn(worldPos: Vec3): Node {
        let enemyNode: Node = null;

        if (this._pool.length > 0) {
            enemyNode = this._pool.pop()!;
        } else if (this.enemyPrefab) {
            enemyNode = instantiate(this.enemyPrefab);
        }

        if (!enemyNode) return null;

        enemyNode.setParent(this.enemyContainer);
        enemyNode.setWorldPosition(worldPos);
        enemyNode.active = true;

        // Reset lại máu và trạng thái quái
        const enemyComp = enemyNode.getComponent('Enemy') as any;
        if (enemyComp && typeof enemyComp.initEnemy === 'function') {
            enemyComp.initEnemy();
        }

        const barAttacher = enemyNode.getComponent('BarAttacher') as any || enemyNode.getComponent('Test') as any;
        if (barAttacher && typeof barAttacher.resetBar === 'function') {
            barAttacher.resetBar();
        }

        const enemyVfx = enemyNode.getComponent('EnemyVFX') as any;
        if (enemyVfx) {
            enemyVfx.stepInterval = 0.32;
        }

        this.activeEnemies.push(enemyNode);
        return enemyNode;
    }

    public recycle(enemyNode: Node) {
        if (!enemyNode || !enemyNode.isValid) return;

        const barAttacher = enemyNode.getComponent('BarAttacher') as any || enemyNode.getComponent('Test') as any;
        if (barAttacher && typeof barAttacher.hideBar === 'function') {
            barAttacher.hideBar();
        }

        const idx = this.activeEnemies.indexOf(enemyNode);
        if (idx !== -1) {
            this.activeEnemies.splice(idx, 1);
        }

        enemyNode.active = false;
        this._pool.push(enemyNode);
    }

    /**
     * Tìm kẻ địch tối ưu cho Paladin theo tiêu chí:
     * ƯU TIÊN KẺ ĐỊCH GẦN NHẤT VÀ THẤP MÁU NHẤT
     * 
     * - Trong phạm vi cận chiến (dist <= meleeThreshold):
     *   Ưu tiên tuyệt đối con có lượng máu (currentHp) thấp nhất để kết liễu trước,
     *   nếu máu bằng nhau thì chọn con gần hơn.
     * 
     * - Ngoài phạm vi cận chiến (dist > meleeThreshold):
     *   Tính điểm kết hợp giữa khoảng cách thực tế và lượng máu còn lại:
     *   score = dist + (currentHp / maxHp) * 3.5 + (currentHp * 0.1)
     *   -> Giúp Paladin ưu tiên áp sát con yếu gần mình mà không chạy quá xa bỏ qua quái áp sát.
     */
    public findTargetEnemy(fromPos: Vec3, maxRadius: number = 999, meleeThreshold: number = 1.8): Node | null {
        let bestEnemy: Node | null = null;
        let bestScore = Infinity;

        const maxRadSq = maxRadius * maxRadius;

        for (let i = 0; i < this.activeEnemies.length; i++) {
            const enemy = this.activeEnemies[i];
            if (!enemy || !enemy.isValid || !enemy.activeInHierarchy) continue;

            const enemyComp = (enemy.getComponent('Enemy') as any)
                || (enemy.getComponent('EnemyStats') as any);
            if (enemyComp) {
                if (enemyComp.isAlive === false || enemyComp.currentHp <= 0) continue;
            }

            enemy.getWorldPosition(this._tempPos);
            // Bỏ qua trục Y (chỉ tính khoảng cách trên mặt phẳng sàn XZ)
            const dx = this._tempPos.x - fromPos.x;
            const dz = this._tempPos.z - fromPos.z;
            const distSq = dx * dx + dz * dz;

            if (distSq > maxRadSq) continue;

            const dist = Math.sqrt(distSq);

            let currentHp = 20;
            let maxHp = 20;
            if (enemyComp) {
                if (typeof enemyComp.currentHp === 'number') currentHp = enemyComp.currentHp;
                if (typeof enemyComp.maxHp === 'number' && enemyComp.maxHp > 0) maxHp = enemyComp.maxHp;
            }

            let score: number;
            if (dist <= meleeThreshold) {
                // Nhóm 1: Trong tầm cận chiến -> Luôn ưu tiên hơn quái ở xa (-1000 điểm cơ sở)
                // Ưu tiên số 1: con thấp máu nhất (currentHp càng nhỏ điểm càng thấp)
                // Ưu tiên số 2: con gần hơn (dist cộng phụ trợ)
                score = -1000 + currentHp * 10 + dist;
            } else {
                // Nhóm 2: Ngoài tầm cận chiến -> Cân bằng giữa cự ly và % máu
                const hpRatio = Math.max(0, Math.min(1, currentHp / maxHp));
                score = dist + hpRatio * 3.5 + currentHp * 0.1;
            }

            if (score < bestScore) {
                bestScore = score;
                bestEnemy = enemy;
            }
        }

        return bestEnemy;
    }

    /** Tìm quái sống theo tiêu chí ưu tiên gần nhất và thấp máu nhất */
    public findNearestEnemy(fromPos: Vec3, maxRadius: number = 999): Node | null {
        return this.findTargetEnemy(fromPos, maxRadius);
    }

    /** Tìm tất cả quái sống nằm trong bán kính */
    public findEnemiesInRadius(centerPos: Vec3, radius: number): Node[] {
        const result: Node[] = [];
        const radiusSq = radius * radius;

        for (let i = 0; i < this.activeEnemies.length; i++) {
            const enemy = this.activeEnemies[i];
            if (!enemy || !enemy.isValid || !enemy.active) continue;

            const enemyComp = enemy.getComponent('Enemy') as any;
            if (enemyComp && !enemyComp.isAlive) continue; // Bỏ qua quái đã chết

            enemy.getWorldPosition(this._tempPos);
            const distSq = Vec3.squaredDistance(centerPos, this._tempPos);
            if (distSq <= radiusSq) {
                result.push(enemy);
            }
        }
        return result;
    }

    /** Tiêu diệt toàn bộ quái trên sân (Kích hoạt Screen Clear Level 3 - Đảm bảo sạch 100%) */
    public killAll() {
        // 1. Dừng ngay lập tức việc sinh thêm quái
        if (this.node.scene) {
            const spawner = this.node.scene.getChildByName('System')?.getChildByName('Manager')?.getComponent('EnemiesSpawner') as any;
            if (spawner) spawner._isStopped = true;
        }

        // 2. Tiêu diệt toàn bộ quái đang active ngay lập tức, không để sót bất kỳ con nào
        const list = [...this.activeEnemies];
        const charVfx = (this.node.scene?.getChildByName('Character')?.getComponent('CharVFX') as any);

        for (let i = 0; i < list.length; i++) {
            const enemy = list[i];
            if (enemy && enemy.isValid) {
                const ep = enemy.worldPosition;
                if (charVfx && typeof charVfx.playHolyBurst === 'function' && i < 12) {
                    charVfx.playHolyBurst(ep, 0.85);
                }
                const enemyComp = enemy.getComponent('Enemy') as any;
                if (enemyComp && typeof enemyComp.die === 'function') {
                    enemyComp.die(true);
                } else {
                    this.recycle(enemy);
                }
            }
        }
        this.activeEnemies.length = 0;
    }

    public getActiveEnemies(): Node[] {
        return [...this.activeEnemies];
    }

    public getActiveCount(): number {
        return this.activeEnemies.length;
    }
}
