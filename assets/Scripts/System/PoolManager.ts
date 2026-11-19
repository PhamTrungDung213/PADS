import { _decorator, Component, Node, Prefab, instantiate, Tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PoolManager')
export class PoolManager extends Component {
    public static instance: PoolManager = null;

    private _pools: Map<string, Node[]> = new Map();

    onLoad() {
        PoolManager.instance = this;
    }

    onDestroy() {
        if (PoolManager.instance === this) {
            PoolManager.instance = null;
        }
        this._pools.forEach((pool) => {
            for (let i = 0; i < pool.length; i++) {
                const n = pool[i];
                if (n && n.isValid) n.destroy();
            }
        });
        this._pools.clear();
    }

    /**
     * Khởi tạo trước số lượng node vào pool (gọi `onBeforeMount` trước `setParent` để Baked SkeletalAnimation bind đủ mesh).
     */
    public prewarm(
        key: string,
        prefab: Prefab | null,
        count: number,
        parent?: Node,
        onBeforeMount?: (node: Node) => void
    ): void {
        if (!prefab || count <= 0) return;
        let pool = this._pools.get(key);
        if (!pool) {
            pool = [];
            this._pools.set(key, pool);
        }

        for (let i = 0; i < count; i++) {
            const node = instantiate(prefab);
            if (onBeforeMount) {
                onBeforeMount(node);
            }
            node.active = false;
            if (parent && parent.isValid) {
                node.setParent(parent);
            }
            pool.push(node);
        }
    }

    public get(
        key: string,
        prefab: Prefab | null,
        parent?: Node,
        onBeforeMount?: (node: Node) => void
    ): Node | null {
        let pool = this._pools.get(key);
        if (!pool) {
            pool = [];
            this._pools.set(key, pool);
        }

        let node: Node | null = null;
        while (pool.length > 0) {
            const candidate = pool.pop()!;
            if (candidate && candidate.isValid) {
                node = candidate;
                break;
            }
        }

        if (!node && prefab) {
            node = instantiate(prefab);
            if (onBeforeMount) {
                onBeforeMount(node);
            }
        }

        if (node) {
            if (parent && parent.isValid && node.parent !== parent) {
                node.setParent(parent);
            }
            node.active = true;
        }
        return node;
    }

    public put(key: string, node: Node | null, parent?: Node): void {
        if (!node || !node.isValid) return;
        Tween.stopAllByTarget(node);
        node.active = false;
        if (parent && parent.isValid && node.parent !== parent) {
            node.setParent(parent);
        }
        let pool = this._pools.get(key);
        if (!pool) {
            pool = [];
            this._pools.set(key, pool);
        }
        if (pool.indexOf(node) < 0) {
            pool.push(node);
        }
    }

    public clearKey(key: string): void {
        const pool = this._pools.get(key);
        if (!pool) return;
        for (let i = 0; i < pool.length; i++) {
            const n = pool[i];
            if (n && n.isValid) n.destroy();
        }
        pool.length = 0;
        this._pools.delete(key);
    }
}
