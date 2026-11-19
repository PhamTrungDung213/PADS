import { _decorator, Component, Node, Vec3, CCFloat } from 'cc';
import { DefChestConfig } from './DefChestConfig';

const { ccclass, property } = _decorator;

interface CircleObstacle {
    x: number;
    z: number;
    r: number;
}

// Đường bờ cát thực tế của đảo (42 đỉnh XZ)
const ISLAND_SHORE_POLYGON: ReadonlyArray<readonly [number, number]> = [
    [15.95, -8.56], [16.13, -9.30], [15.65, -10.35], [14.28, -10.54], [12.49, -10.28], [11.88, -10.64],
    [10.44, -9.73], [9.60, -10.58], [8.03, -11.36], [6.60, -10.71], [5.62, -11.43], [3.33, -11.63],
    [-0.50, -10.28], [-1.63, -10.49], [-2.45, -9.97], [-2.87, -8.77], [-4.25, -7.58], [-6.50, -5.00],
    [-7.78, -1.64], [-7.40, 2.32], [-5.87, 3.61], [-4.75, 5.32], [-3.68, 6.56], [-2.85, 7.57],
    [-1.62, 7.80], [-0.40, 8.70], [1.44, 8.61], [3.03, 8.21], [3.76, 8.58], [4.31, 8.49],
    [4.89, 7.76], [6.42, 7.51], [8.86, 4.95], [9.96, 2.71], [10.50, -0.52], [10.55, -1.80],
    [11.36, -3.67], [12.55, -4.12], [12.87, -4.98], [14.24, -6.12], [14.65, -7.27], [15.60, -7.86],
];

const SAFE_CENTER_X = 3.8;
const SAFE_CENTER_Z = -1.5;

const _tmpWp = new Vec3();
const _clampBuf = { x: 0, z: 0 };

/** Giới hạn di chuyển trong đa giác bờ đảo & đẩy trượt vật cản nội khu. */
@ccclass('DefChestArenaBounds')
export class DefChestArenaBounds extends Component {
    public static instance: DefChestArenaBounds | null = null;

    @property({ type: Node, tooltip: 'Rương Kho Báu (Map/BaseClearChest)' })
    public chestNode: Node = null;

    @property({ type: [Node], tooltip: 'Các vật cản nội khu (Lửa trại, Cột đá)' })
    public obstacleNodes: Node[] = [];

    @property({ type: CCFloat, tooltip: 'Bán kính cản của Rương (m)' })
    public chestObstacleRadius: number = 1.25;

    @property({ type: CCFloat, tooltip: 'Bán kính cản của Lửa trại / Cột đá (m)' })
    public propObstacleRadius: number = 0.78;

    @property({ type: CCFloat, tooltip: 'Độ cao mặt sàn đảo cố định (Y)' })
    public groundY: number = 0.32;

    private _obstacles: CircleObstacle[] = [];

    protected onLoad(): void {
        DefChestArenaBounds.instance = this;
        this.rebuildObstacles();
    }

    protected start(): void {
        this.rebuildObstacles();
    }

    protected onDestroy(): void {
        if (DefChestArenaBounds.instance === this) DefChestArenaBounds.instance = null;
    }

    public rebuildObstacles(): void {
        this._obstacles.length = 0;

        if (!this.chestNode && this.node.scene) {
            this.chestNode = this.node.scene.getChildByPath('Map/BaseClearChest');
        }

        if (this.obstacleNodes && this.obstacleNodes.length > 0) {
            for (let i = 0; i < this.obstacleNodes.length; i++) {
                const n = this.obstacleNodes[i];
                if (n && n.isValid) {
                    n.getWorldPosition(_tmpWp);
                    this._obstacles.push({ x: _tmpWp.x, z: _tmpWp.z, r: this.propObstacleRadius });
                }
            }
        } else {
            this._obstacles.push(
                { x: 6.003, z: -0.342, r: 0.78 },
                { x: -4.055, z: -1.846, r: 0.78 },
                { x: 1.48, z: 1.92, r: 0.92 },
            );
        }
    }

    public resolveHeroPosition(pos: Vec3, customRadius?: number): Vec3 {
        const cfg = DefChestConfig.instance;
        const inset = cfg ? cfg.heroShoreInset : 0.55;
        const radius = customRadius ?? (cfg ? cfg.heroCollisionRadius : 0.45);
        return this.resolveEntityPosition(pos, inset, radius, true);
    }

    public resolveEnemyPosition(pos: Vec3, customRadius?: number, avoidChestBody: boolean = true): Vec3 {
        const cfg = DefChestConfig.instance;
        const inset = cfg ? cfg.enemyShoreInset : 0.32;
        const radius = customRadius ?? (cfg ? cfg.enemyCollisionRadius : 0.42);
        return this.resolveEntityPosition(pos, inset, radius, avoidChestBody);
    }

    private resolveEntityPosition(pos: Vec3, inset: number, radius: number, includeChest: boolean): Vec3 {
        _clampBuf.x = pos.x;
        _clampBuf.z = pos.z;

        this.clampInsidePolygonInPlace(_clampBuf, inset);
        const moved = this.resolveObstaclesInPlace(_clampBuf, radius, includeChest);
        if (moved) {
            this.clampInsidePolygonInPlace(_clampBuf, inset);
        }

        pos.set(_clampBuf.x, this.groundY, _clampBuf.z);
        return pos;
    }

    public isPointInsideIsland(x: number, z: number): boolean {
        const poly = ISLAND_SHORE_POLYGON;
        const n = poly.length;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = poly[i][0], zi = poly[i][1];
            const xj = poly[j][0], zj = poly[j][1];
            if (((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-10) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private clampInsidePolygonInPlace(pt: { x: number; z: number }, shoreInset: number): void {
        const poly = ISLAND_SHORE_POLYGON;
        const n = poly.length;
        const x = pt.x;
        const z = pt.z;
        const inside = this.isPointInsideIsland(x, z);

        let minDistSq = Infinity;
        let closestX = x;
        let closestZ = z;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const ax = poly[j][0], az = poly[j][1];
            const abx = poly[i][0] - ax;
            const abz = poly[i][1] - az;
            const lenSq = abx * abx + abz * abz;
            let t = lenSq > 1e-8 ? ((x - ax) * abx + (z - az) * abz) / lenSq : 0;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;

            const px = ax + t * abx;
            const pz = az + t * abz;
            const dSq = (x - px) * (x - px) + (z - pz) * (z - pz);
            if (dSq < minDistSq) {
                minDistSq = dSq;
                closestX = px;
                closestZ = pz;
            }
        }

        if (!inside) {
            let cx = SAFE_CENTER_X - closestX;
            let cz = SAFE_CENTER_Z - closestZ;
            const len = Math.hypot(cx, cz) || 1;
            const push = shoreInset + 0.05;
            pt.x = closestX + (cx / len) * push;
            pt.z = closestZ + (cz / len) * push;
            return;
        }

        if (minDistSq < shoreInset * shoreInset) {
            const minDist = Math.sqrt(minDistSq);
            let ix = x - closestX;
            let iz = z - closestZ;
            let len = Math.hypot(ix, iz);
            if (len < 1e-4) {
                ix = SAFE_CENTER_X - closestX;
                iz = SAFE_CENTER_Z - closestZ;
                len = Math.hypot(ix, iz) || 1;
            }
            const push = shoreInset - minDist;
            pt.x = x + (ix / len) * push;
            pt.z = z + (iz / len) * push;
        }
    }

    private resolveObstaclesInPlace(pt: { x: number; z: number }, entityRadius: number, includeChest: boolean): boolean {
        let moved = false;

        if (includeChest && this.chestNode && this.chestNode.isValid) {
            const cp = this.chestNode.worldPosition;
            if (this.pushOutOfCircle(pt, cp.x, cp.z, this.chestObstacleRadius + entityRadius)) {
                moved = true;
            }
        }

        for (let i = 0; i < this._obstacles.length; i++) {
            const ob = this._obstacles[i];
            if (this.pushOutOfCircle(pt, ob.x, ob.z, ob.r + entityRadius)) {
                moved = true;
            }
        }
        return moved;
    }

    private pushOutOfCircle(pt: { x: number; z: number }, ox: number, oz: number, minD: number): boolean {
        const dx = pt.x - ox;
        const dz = pt.z - oz;
        const dSq = dx * dx + dz * dz;
        if (dSq >= minD * minD) return false;

        const d = Math.sqrt(dSq) || 0.001;
        const overlap = minD - d;
        pt.x += (dx / d) * overlap;
        pt.z += (dz / d) * overlap;
        return true;
    }
}
