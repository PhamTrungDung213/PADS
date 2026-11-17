import { _decorator, Component, Node, Vec3, Quat } from 'cc';
const { ccclass } = _decorator;

export interface WallOBB {
    name: string;
    cx: number;
    cz: number;
    angle: number; // Góc xoay quanh trục Y (radians)
    hx: number;    // Bán kính nửa chiều dài (X)
    hz: number;    // Bán kính nửa chiều rộng (Z)
}

// Bảng tọa độ, góc xoay quaternion và kích thước của đúng 13 khối tường bao quanh đảo mà bạn đã căn chỉnh
const DEFAULT_WALLS: WallOBB[] = [
    // Block0: pos (-0.855, 8.993), yRot 0.00753975, wRot 0.99997158, size (4.034, 1.0)
    { name: 'Block0', cx: -0.855, cz: 8.993, angle: 2 * Math.atan2(0.00753975, 0.99997158), hx: 4.034 * 0.5, hz: 1.0 * 0.5 },
    // Block1: pos (-5.604, 7.467), yRot -0.26053831, wRot 0.96546352, size (7.937, 1.0)
    { name: 'Block1', cx: -5.604, cz: 7.467, angle: 2 * Math.atan2(-0.26053831, 0.96546352), hx: 7.937 * 0.5, hz: 1.0 * 0.5 },
    // Block2: pos (-11.289, -2.373), yRot 0.68278936, wRot 0.73061528, size (7.937, 1.0)
    { name: 'Block2', cx: -11.289, cz: -2.373, angle: 2 * Math.atan2(0.68278936, 0.73061528), hx: 7.937 * 0.5, hz: 1.0 * 0.5 },
    // Block3: pos (-8.705, -7.094), yRot 0.39504852, wRot 0.91866026, size (7.937, 1.0)
    { name: 'Block3', cx: -8.705, cz: -7.094, angle: 2 * Math.atan2(0.39504852, 0.91866026), hx: 7.937 * 0.5, hz: 1.0 * 0.5 },
    // Block4: pos (0.133, -12.041), yRot 0.05933251, wRot 0.99823827, size (7.937, 1.0)
    { name: 'Block4', cx: 0.133, cz: -12.041, angle: 2 * Math.atan2(0.05933251, 0.99823827), hx: 7.937 * 0.5, hz: 1.0 * 0.5 },
    // Block5: pos (4.999, -11.84), yRot -0.03365232, wRot 0.9994336, size (7.937, 1.0)
    { name: 'Block5', cx: 4.999, cz: -11.84, angle: 2 * Math.atan2(-0.03365232, 0.9994336), hx: 7.937 * 0.5, hz: 1.0 * 0.5 },
    // Block6: pos (9.536, -11.332), yRot -0.13155571, wRot 0.99130878, size (11.325, 1.0)
    { name: 'Block6', cx: 9.536, cz: -11.332, angle: 2 * Math.atan2(-0.13155571, 0.99130878), hx: 11.325 * 0.5, hz: 1.0 * 0.5 },
    // Block7: pos (10.585, -5.048), yRot -0.92707267, wRot 0.37488168, size (3.103, 1.0)
    { name: 'Block7', cx: 10.585, cz: -5.048, angle: 2 * Math.atan2(-0.92707267, 0.37488168), hx: 3.103 * 0.5, hz: 1.0 * 0.5 },
    // Block8: pos (10.868, -2.802), yRot -0.52146392, wRot 0.85327333, size (3.103, 1.0)
    { name: 'Block8', cx: 10.868, cz: -2.802, angle: 2 * Math.atan2(-0.52146392, 0.85327333), hx: 3.103 * 0.5, hz: 1.0 * 0.5 },
    // Block9: pos (11.301, -0.055), yRot -0.78189055, wRot 0.62341572, size (3.103, 1.0)
    { name: 'Block9', cx: 11.301, cz: -0.055, angle: 2 * Math.atan2(-0.78189055, 0.62341572), hx: 3.103 * 0.5, hz: 1.0 * 0.5 },
    // Block10: pos (9.663, 2.031), yRot -0.9439566, wRot 0.3300696, size (3.103, 1.0)
    { name: 'Block10', cx: 9.663, cz: 2.031, angle: 2 * Math.atan2(-0.9439566, 0.3300696), hx: 3.103 * 0.5, hz: 1.0 * 0.5 },
    // Block11: pos (7.266, 3.454), yRot -0.90116026, wRot 0.43348608, size (3.103, 1.0)
    { name: 'Block11', cx: 7.266, cz: 3.454, angle: 2 * Math.atan2(-0.90116026, 0.43348608), hx: 3.103 * 0.5, hz: 1.0 * 0.5 },
    // Block12: pos (5.524, 5.846), yRot -0.89539724, wRot 0.44526821, size (3.103, 1.0)
    { name: 'Block12', cx: 5.524, cz: 5.846, angle: 2 * Math.atan2(-0.89539724, 0.44526821), hx: 3.103 * 0.5, hz: 1.0 * 0.5 }
];

/**
 * IslandWallCollision - Bộ giải quyết va chạm hình hộp xoay (OBB) siêu nhẹ
 * Tự động đồng bộ và cản theo đúng 13 khối tường đảo mà không cần đến thư viện PhysX 7.1 MB
 */
@ccclass('IslandWallCollision')
export class IslandWallCollision extends Component {
    public static instance: IslandWallCollision | null = null;
    private static _activeWalls: WallOBB[] = DEFAULT_WALLS;

    onLoad() {
        IslandWallCollision.instance = this;
        this.syncFromScene();
    }

    public syncFromScene() {
        const root = this.node.scene || this.node;
        const blockParent = root.getChildByPath('Map/Block');
        if (blockParent && blockParent.children.length > 0) {
            const tempPos = new Vec3();
            const tempRot = new Quat();
            const synced: WallOBB[] = [];

            blockParent.children.forEach(child => {
                if (child.name.startsWith('Block') && child.name !== 'Block') {
                    child.getWorldPosition(tempPos);
                    child.getWorldRotation(tempRot);
                    const angleRad = 2 * Math.atan2(tempRot.y, tempRot.w);

                    // Tìm kích thước tương ứng từ bảng mẫu
                    const def = DEFAULT_WALLS.find(w => w.name === child.name);
                    const hx = def ? def.hx : 2.0;
                    const hz = def ? def.hz : 0.5;

                    synced.push({
                        name: child.name,
                        cx: tempPos.x,
                        cz: tempPos.z,
                        angle: angleRad,
                        hx: hx,
                        hz: hz
                    });
                }
            });

            if (synced.length > 0) {
                IslandWallCollision._activeWalls = synced;
            }
        }
    }

    /**
     * Phương thức tĩnh giải quyết va chạm tức thì - Gọi trực tiếp không cần đợi Component lifecycle
     */
    public static resolve(x: number, z: number, radius: number = 0.5): { x: number, z: number } {
        const walls = IslandWallCollision._activeWalls;
        let currX = x;
        let currZ = z;

        for (let iter = 0; iter < 2; iter++) {
            let hasCollision = false;

            for (let i = 0; i < walls.length; i++) {
                const wall = walls[i];
                const cos = Math.cos(-wall.angle);
                const sin = Math.sin(-wall.angle);

                const dx = currX - wall.cx;
                const dz = currZ - wall.cz;
                const lx = dx * cos - dz * sin;
                const lz = dx * sin + dz * cos;

                const clampX = Math.max(-wall.hx, Math.min(wall.hx, lx));
                const clampZ = Math.max(-wall.hz, Math.min(wall.hz, lz));

                const diffX = lx - clampX;
                const diffZ = lz - clampZ;
                const distSq = diffX * diffX + diffZ * diffZ;

                if (distSq < radius * radius) {
                    hasCollision = true;
                    const dist = Math.sqrt(distSq);
                    let pushX = 0;
                    let pushZ = 0;

                    if (dist > 0.0001) {
                        const overlap = radius - dist;
                        pushX = (diffX / dist) * overlap;
                        pushZ = (diffZ / dist) * overlap;
                    } else {
                        const dLeft = lx - (-wall.hx);
                        const dRight = wall.hx - lx;
                        const dBottom = lz - (-wall.hz);
                        const dTop = wall.hz - lz;
                        const minD = Math.min(dLeft, dRight, dBottom, dTop);

                        if (minD === dLeft) pushX = -(radius + dLeft);
                        else if (minD === dRight) pushX = (radius + dRight);
                        else if (minD === dBottom) pushZ = -(radius + dBottom);
                        else pushZ = (radius + dTop);
                    }

                    const newLx = lx + pushX;
                    const newLz = lz + pushZ;
                    const cosW = Math.cos(wall.angle);
                    const sinW = Math.sin(wall.angle);

                    currX = wall.cx + newLx * cosW - newLz * sinW;
                    currZ = wall.cz + newLx * sinW + newLz * cosW;
                }
            }

            if (!hasCollision) break;
        }

        return { x: currX, z: currZ };
    }
}
