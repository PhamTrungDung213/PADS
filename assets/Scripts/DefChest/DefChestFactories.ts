import { Node, Prefab, Material, Vec3 } from 'cc';
import {
    DefChestEnemyKind,
    DefChestHeroRole,
    DefChestSkillOption,
    DefChestUpgradeTier,
    IDefChestHeroTarget,
} from './DefChestTypes';
import { PoolManager } from '../System/PoolManager';
import { DefChestEnemyVisual } from './DefChestEnemyVisual';
import { DefChestEnemyController } from './DefChestEnemyController';
import { DefChestSkillStrategyRegistry } from './DefChestSkillStrategies';

export interface DefChestEnemyFactoryDeps {
    basicEnemyPrefab: Prefab | null;
    eliteEnemyPrefab: Prefab | null;
    container: Node;
    outlineRedMat?: Material | null;
    enemyHpBarPrefab?: Prefab | null;
    fxEliteSkillPrefab?: Prefab | null;
    fxSmokeDiePrefab?: Prefab | null;
    fxBoneHitPrefab?: Prefab | null;
}

const POOL_KEY_ENEMY_BASIC = 'DefChest_Enemy_Basic';
const POOL_KEY_ENEMY_ELITE = 'DefChest_Enemy_Elite';

/**
 * DefChestEnemyFactory — Factory Pattern kết hợp trực tiếp với `PoolManager` sẵn có của dự án:
 * - Gỡ toàn bộ script cũ & gắn mesh viền đỏ thông qua `onBeforeMount` TRƯỚC KHI node gắn vào Scene,
 *   giúp `SkeletalAnimation` (Baked Animation) chạy mượt 100%.
 */
export class DefChestEnemyFactory {
    private _deps: DefChestEnemyFactoryDeps;
    private _poolMgr: PoolManager;
    private _slotCounter: number = 0;

    constructor(deps: DefChestEnemyFactoryDeps) {
        this._deps = deps;
        this._poolMgr = PoolManager.instance
            || deps.container.getComponent(PoolManager)
            || deps.container.addComponent(PoolManager);

        if (deps.basicEnemyPrefab) {
            this._poolMgr.prewarm(
                POOL_KEY_ENEMY_BASIC,
                deps.basicEnemyPrefab,
                15,
                deps.container,
                (node) => DefChestEnemyVisual.preparePrefabInstanceBeforeMount(node, false, deps.outlineRedMat)
            );
        }
        if (deps.eliteEnemyPrefab) {
            this._poolMgr.prewarm(
                POOL_KEY_ENEMY_ELITE,
                deps.eliteEnemyPrefab,
                1,
                deps.container,
                (node) => DefChestEnemyVisual.preparePrefabInstanceBeforeMount(node, true, null)
            );
        }
    }

    public createEnemy(
        kind: DefChestEnemyKind,
        worldPos: Vec3,
        getHeroes: () => IDefChestHeroTarget[],
        onDeath: (enemy: DefChestEnemyController) => void
    ): DefChestEnemyController | null {
        const isElite = kind === DefChestEnemyKind.ELITE;
        const poolKey = isElite ? POOL_KEY_ENEMY_ELITE : POOL_KEY_ENEMY_BASIC;
        const prefab = isElite ? this._deps.eliteEnemyPrefab : this._deps.basicEnemyPrefab;
        if (!prefab) return null;

        const node = this._poolMgr.get(
            poolKey,
            prefab,
            this._deps.container,
            (n) => DefChestEnemyVisual.preparePrefabInstanceBeforeMount(n, isElite, isElite ? null : this._deps.outlineRedMat)
        );
        if (!node) return null;

        const ctrl = node.getComponent(DefChestEnemyController)
            || node.addComponent(DefChestEnemyController);

        this._slotCounter++;
        const goldenAngle = 2.3999632;
        const slotAngle = (this._slotCounter * goldenAngle) % (Math.PI * 2);

        ctrl.initEnemy({
            kind,
            spawnWorldPos: worldPos,
            stealSlotAngle: slotAngle,
            getHeroes,
            onDeath,
            vfxContainer: this._deps.container,
            outlineMat: this._deps.outlineRedMat,
            enemyHpBarPrefab: this._deps.enemyHpBarPrefab,
            fxEliteSkillPrefab: this._deps.fxEliteSkillPrefab,
            fxSmokeDiePrefab: this._deps.fxSmokeDiePrefab,
            fxBoneHitPrefab: this._deps.fxBoneHitPrefab,
        });

        return ctrl;
    }

    public recycleEnemy(enemy: DefChestEnemyController): void {
        if (!enemy || !enemy.node || !enemy.node.isValid) return;
        const poolKey = enemy.enemyKind === DefChestEnemyKind.ELITE
            ? POOL_KEY_ENEMY_ELITE
            : POOL_KEY_ENEMY_BASIC;
        if (this._poolMgr && this._poolMgr.isValid) {
            this._poolMgr.put(poolKey, enemy.node, this._deps.container);
        } else {
            enemy.node.active = false;
        }
    }

    public clear(): void {
        if (this._poolMgr && this._poolMgr.isValid) {
            this._poolMgr.clearKey(POOL_KEY_ENEMY_BASIC);
            this._poolMgr.clearKey(POOL_KEY_ENEMY_ELITE);
        }
    }
}

export class DefChestSkillFactory {
    public static createOptionsForHero(
        role: DefChestHeroRole,
        tier: DefChestUpgradeTier
    ): DefChestSkillOption[] {
        return DefChestSkillStrategyRegistry.getSkillOptions(role, tier);
    }
}
