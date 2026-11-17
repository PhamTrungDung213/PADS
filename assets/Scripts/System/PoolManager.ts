import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
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
        this._pools.clear();
    }

    public get(key: string, prefab: Prefab, parent?: Node): Node {
        let pool = this._pools.get(key);
        if (!pool) {
            pool = [];
            this._pools.set(key, pool);
        }

        let node: Node = null;
        if (pool.length > 0) {
            node = pool.pop()!;
        } else if (prefab) {
            node = instantiate(prefab);
        }

        if (node) {
            if (parent) node.setParent(parent);
            node.active = true;
        }
        return node;
    }

    public put(key: string, node: Node) {
        if (!node || !node.isValid) return;
        node.active = false;
        let pool = this._pools.get(key);
        if (!pool) {
            pool = [];
            this._pools.set(key, pool);
        }
        pool.push(node);
    }
}
