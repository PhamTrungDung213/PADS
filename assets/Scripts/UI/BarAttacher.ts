import { _decorator, Component, Node, Camera, Vec3, Prefab, instantiate, CCFloat, director, Canvas, js } from 'cc';
import { HPBar } from './HPBar';
import { ExpBar } from './ExpBar';
import { CharStats } from '../Char/CharStats';
import { GameManager } from '../System/GameManager';

const { ccclass, property } = _decorator;

/**
 * Quản lý thanh Bar 3D Billboard trên đầu mục tiêu:
 * - Nhân vật: TUYỆT ĐỐI CHỈ CÓ ExpBar (Vàng kim từ ExpBar.prefab)
 * - Quái vật: TUYỆT ĐỐI CHỈ CÓ HpBar (Đỏ từ HpBar.prefab)
 * - Thanh Bar được đặt ở cấp độc lập (parent của mục tiêu hoặc Scene Root),
 *   nhờ đó bám sát 1:1 theo tọa độ thế giới của mục tiêu mà KHÔNG bị ảnh hưởng
 *   bởi tỉ lệ co giãn (scale), góc xoay (rotation) hay physics controller của model.
 */
@ccclass('BarAttacher')
export class BarAttacher extends Component {
    @property({ type: Node, tooltip: '3D target node to attach health/exp bar' })
    public targetNode: Node = null;

    @property({ type: Camera, tooltip: '3D world camera' })
    public worldCamera: Camera = null;

    @property({ type: Prefab, tooltip: 'Enemy health bar prefab (HpBar.prefab)' })
    public hpBarPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Player exp bar prefab (ExpBar.prefab)' })
    public expBarPrefab: Prefab = null;

    @property({ tooltip: '3D offset above target head' })
    public offset3D: Vec3 = new Vec3(0, 1.35, 0);

    @property({ type: CCFloat, tooltip: '3D bar scale factor' })
    public barScale: number = 0.01;

    private _barNode: Node = null;
    private _hpBarComp: HPBar = null;
    private _expBarComp: ExpBar = null;
    private _enemyStats: any = null;
    private _isPlayer: boolean = false;
    private _tempPos: Vec3 = new Vec3();
    private _barWorldPos: Vec3 = new Vec3();
    private _prefabScale: Vec3 = new Vec3(1, 1, 1);

    onLoad() {
        this.checkIsPlayer();

        if (!this._isPlayer) {
            // Đối với quái, targetNode LUÔN LUÔN chính là this.node
            this.targetNode = this.node;
            this._enemyStats = (this.node.getComponent('Enemy') as any)
                || (this.node.getComponent('EnemyStats') as any);
        } else {
            if (!this.targetNode) {
                this.targetNode = this.node;
            }
            this.resolveCamera();
            this.createBar();
        }
    }

    private checkIsPlayer(): boolean {
        const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
        if (!target) {
            this._isPlayer = false;
            return false;
        }

        if (target.getComponent(CharStats) || this.getComponent(CharStats)) {
            this._isPlayer = true;
            return true;
        }

        if (target.name === 'Character' || this.node.name === 'Character') {
            this._isPlayer = true;
            return true;
        }

        let curr: Node | null = target.parent;
        while (curr) {
            if (curr.name === 'Character' || curr.getComponent(CharStats)) {
                this._isPlayer = true;
                return true;
            }
            curr = curr.parent;
        }

        this._isPlayer = false;
        return false;
    }

    onDisable() {
        this.hideBar();
    }

    onDestroy() {
        if (this._barNode && this._barNode.isValid) {
            this._barNode.destroy();
            this._barNode = null;
        }
    }

    start() {
        if (this._isPlayer) {
            this.resolveCamera();
            this.createBar();
        }
    }

    private isUnderCanvas(node: Node): boolean {
        let curr: Node | null = node;
        while (curr) {
            if (curr.getComponent(Canvas)) return true;
            curr = curr.parent;
        }
        return false;
    }

    private resolveCamera(): Camera | null {
        if (this.worldCamera && this.worldCamera.isValid && this.worldCamera.node && this.worldCamera.node.isValid) {
            return this.worldCamera;
        }

        // Tìm 3D Camera trong scene (loại trừ UICamera dưới Canvas)
        const scene = director.getScene();
        if (scene) {
            const cameras = scene.getComponentsInChildren(Camera);
            for (let i = 0; i < cameras.length; i++) {
                const cam = cameras[i];
                if (cam && cam.node && cam.node.isValid && !this.isUnderCanvas(cam.node)) {
                    this.worldCamera = cam;
                    return cam;
                }
            }
        }
        return null;
    }

    public createBar() {
        if (!this.isValid || !this.node || !this.node.isValid) return;
        if (this._barNode && this._barNode.isValid) return;
        this.checkIsPlayer();

        const prefabToUse = this._isPlayer ? this.expBarPrefab : this.hpBarPrefab;
        if (!prefabToUse) return;

        // Cho vào root của scene để đảm bảo scale độc lập 1:1, không bị co giãn theo model
        let sceneRoot: Node = director.getScene() as any;

        this._barNode = instantiate(prefabToUse);
        this._barNode.setParent(sceneRoot);

        // Đọc scale chuẩn từ chính Prefab
        const initScale = this._barNode.scale;
        this._prefabScale.set(
            initScale.x > 0 ? initScale.x : 1.0,
            initScale.y > 0 ? initScale.y : (this._isPlayer ? 0.3 : 0.4),
            initScale.z > 0 ? initScale.z : 1.0
        );

        this.applyBarScale();
        this.updatePosition();

        const cam = this.resolveCamera();
        if (cam && cam.node && cam.node.isValid) {
            this._barNode.setWorldRotation(cam.node.worldRotation);
        }

        if (this._isPlayer) {
            this._barNode.active = true;
            this._barNode.name = 'Hero_ExpBar';
            this._expBarComp = this._barNode.getComponent(ExpBar) || this._barNode.addComponent(ExpBar);
            const gm = GameManager.instance;
            const initialRatio = gm && typeof (gm as any).getExpRatio === 'function' ? (gm as any).getExpRatio() : 0;
            if (this._expBarComp) {
                this._expBarComp.setProgress(initialRatio);
            }
        } else {
            // Quái: Mặc định ẩn hoàn toàn khi chưa bị đánh
            this._barNode.active = false;
            this._barNode.name = 'Enemy_HpBar_' + this.node.name;
            this._hpBarComp = this._barNode.getComponent(HPBar) || this._barNode.addComponent(HPBar);
        }
    }

    public setHpRatio(ratio: number) {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        if (this._isPlayer) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
            }
            if (this._barNode && this._barNode.isValid) {
                this._barNode.active = true;
                this.updatePosition();
            }
            if (this._expBarComp) {
                this._expBarComp.setProgress(ratio);
            }
            return;
        }

        // Đối với quái: chỉ hiện khi bị mất máu (ratio < 1.0) và còn sống (ratio > 0)
        if (ratio < 1.0 && ratio > 0) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
            }
            if (this._barNode && this._barNode.isValid) {
                this.applyBarScale();
                this._barNode.active = true;
                this.updatePosition();
                const cam = this.resolveCamera();
                if (cam && cam.node && cam.node.isValid) {
                    this._barNode.setWorldRotation(cam.node.worldRotation);
                }
                if (this._hpBarComp) {
                    this._hpBarComp.setProgress(ratio);
                }
            }
        } else {
            this.hideBar();
        }
    }

    public resetBar() {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        if (this._isPlayer) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
            }
            if (this._barNode && this._barNode.isValid) {
                this.applyBarScale();
                this._barNode.active = true;
                this.updatePosition();
            }
            if (this._expBarComp) {
                this._expBarComp.setProgress(0);
            }
        } else {
            this.hideBar();
        }
    }

    public hideBar() {
        if (this._barNode && this._barNode.isValid) {
            this._barNode.active = false;
        }
    }

    /**
     * Áp dụng scale chính xác: Scale gốc do bạn chỉnh trong Prefab (X, Y, Z) nhân với hệ số barScale
     */
    private applyBarScale() {
        if (!this._barNode || !this._barNode.isValid) return;
        this._barNode.setScale(
            this._prefabScale.x * this.barScale,
            this._prefabScale.y * this.barScale,
            this._prefabScale.z * this.barScale
        );
    }

    private updatePosition() {
        if (!this._barNode || !this._barNode.isValid) return;
        const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
        if (!target || !target.isValid) return;

        target.getWorldPosition(this._tempPos);
        this._barWorldPos.set(
            this._tempPos.x + this.offset3D.x,
            this._tempPos.y + this.offset3D.y,
            this._tempPos.z + this.offset3D.z
        );
        this._barNode.setWorldPosition(this._barWorldPos);
    }

    lateUpdate(deltaTime: number) {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        if (this._isPlayer) {
            if (!this._barNode || !this._barNode.isValid) {
                this.createBar();
                if (!this._barNode || !this._barNode.isValid) return;
            }

            const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
            if (!target || !target.isValid || !target.activeInHierarchy) {
                this.hideBar();
                return;
            }

            this.updatePosition();
            const cam = this.resolveCamera();
            if (cam && cam.node && cam.node.isValid) {
                this._barNode.setWorldRotation(cam.node.worldRotation);
            }

            this._barNode.active = true;
            const gm = GameManager.instance;
            if (gm && this._expBarComp && typeof (gm as any).getExpRatio === 'function') {
                this._expBarComp.setProgress((gm as any).getExpRatio());
            }
        } else {
            // Đối với quái: Nếu không có thanh máu gán thì không cần tính toán vị trí, tiết kiệm CPU tối đa
            if (!this._barNode || !this._barNode.isValid || !this._barNode.active) {
                return;
            }

            const target = (this.targetNode && this.targetNode.isValid) ? this.targetNode : this.node;
            if (!target || !target.isValid || !target.activeInHierarchy) {
                this.hideBar();
                return;
            }

            this.updatePosition();
            const cam = this.resolveCamera();
            if (cam && cam.node && cam.node.isValid) {
                this._barNode.setWorldRotation(cam.node.worldRotation);
            }

            if (!this._enemyStats) {
                this._enemyStats = (this.node.getComponent('Enemy') as any)
                    || (this.node.getComponent('EnemyStats') as any)
                    || (this.targetNode ? this.targetNode.getComponent('Enemy') as any : null);
            }

            if (this._enemyStats) {
                if (!this._enemyStats.isAlive || this._enemyStats.currentHp <= 0) {
                    this.hideBar();
                    return;
                }

                if (this._enemyStats.currentHp < this._enemyStats.maxHp) {
                    this._barNode.active = true;
                    if (this._hpBarComp && this._enemyStats.maxHp > 0) {
                        this._hpBarComp.setProgress(this._enemyStats.currentHp / this._enemyStats.maxHp);
                    }
                } else {
                    this.hideBar();
                }
            } else {
                this.hideBar();
            }
        }
    }
}

// Đăng ký alias đảm bảo tương thích ngược mọi tham chiếu cũ
js.setClassName('BarAttacher', BarAttacher);
js.setClassName('Test', BarAttacher);
