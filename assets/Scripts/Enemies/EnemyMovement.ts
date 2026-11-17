import { _decorator, Component, Node, Vec3, Quat, CCFloat } from 'cc';
import { EnemyPool } from './EnemyPool';
import { GameManager } from '../System/GameManager';
import { EnemyConfig } from '../Config/EnemyConfig';

const { ccclass, property } = _decorator;

@ccclass('EnemyMovement')
export class EnemyMovement extends Component {
    @property({ type: CCFloat, tooltip: 'Tốc độ di chuyển tiến vào Hero (m/s)' })
    public moveSpeed: number = 3.0;

    @property({ type: CCFloat, tooltip: 'Tốc độ xoay hướng mặt quái' })
    public rotateSpeed: number = 7.0;

    @property({ type: CCFloat, tooltip: 'Khoảng cách dừng trước Hero (m - quái dừng lại ở cự ly này để chém)' })
    public stopDistance: number = 0.75;

    @property({ type: CCFloat, tooltip: 'Khoảng cách tự cách nhau giữa các quái để bủa vây (m)' })
    public separationRadius: number = 0.85;

    @property({ type: CCFloat, tooltip: 'Lực tách đàn giữa các con quái để dàn hàng bủa vây bao quanh Hero' })
    public separationForce: number = 2.0;

    @property({ type: Node, tooltip: 'Xương gốc của model quái (Root_M / Root / Hips)' })
    public rootBone: Node = null!;

    private _heroNode: Node | null = null;

    private _myPos: Vec3 = new Vec3();
    private _heroPos: Vec3 = new Vec3();
    private _otherPos: Vec3 = new Vec3();

    private _toHeroDir: Vec3 = new Vec3();
    private _separationForce: Vec3 = new Vec3();
    private _moveDir: Vec3 = new Vec3();
    private _smoothMoveDir: Vec3 = new Vec3();
    private _facingDir: Vec3 = new Vec3();

    private _targetRot: Quat = new Quat();
    private _currentRot: Quat = new Quat();
    private _displacement: Vec3 = new Vec3();

    private _isMovementLocked: boolean = false;
    private _isMoving: boolean = false;
    private _pushDampenTimer: number = 0;

    onLoad() {
        this.findHero();
        this.applyConfig();
    }

    start() {
        this._resolveRootBone();
    }

    private _resolveRootBone() {
        if (this.rootBone && this.rootBone.isValid) return;
        this.rootBone = this._findBoneByName(this.node, 'Root_M')
            || this._findBoneByName(this.node, 'Root')
            || this._findBoneByName(this.node, 'Hips')
            || this._findBoneByName(this.node, 'Bip01')
            || this._findBoneByName(this.node, 'pelvis');
    }

    private _findBoneByName(parent: Node, name: string): Node | null {
        if (!parent) return null;
        if (parent.name === name) return parent;
        for (let i = 0; i < parent.children.length; i++) {
            const found = this._findBoneByName(parent.children[i], name);
            if (found) return found;
        }
        return null;
    }

    lateUpdate(deltaTime: number) {
        if (!this.rootBone || !this.rootBone.isValid) {
            this._resolveRootBone();
        }
        if (this.rootBone && this.rootBone.isValid) {
            const curPos = this.rootBone.position;
            if (curPos.x !== 0 || curPos.z !== 0) {
                this.rootBone.setPosition(0, curPos.y, 0);
            }
        }
    }

    /**
     * Nạp các thông số di chuyển từ EnemyConfig nếu có
     */
    public applyConfig() {
        const config = EnemyConfig.instance;
        if (config) {
            if (config.moveSpeed > 0) this.moveSpeed = config.moveSpeed;
            if (config.rotateSpeed > 0) this.rotateSpeed = config.rotateSpeed;
            if (config.stopDistance > 0) this.stopDistance = config.stopDistance;
            if (config.separationRadius > 0) this.separationRadius = config.separationRadius;
            if (config.separationForce > 0) this.separationForce = config.separationForce;
        }
    }

    public setTarget(hero: Node) {
        this._heroNode = hero;
    }

    public getTarget(): Node | null {
        if (!this._heroNode || !this._heroNode.isValid) {
            this.findHero();
        }
        return this._heroNode;
    }

    private findHero(): Node | null {
        this._heroNode = (GameManager.instance && GameManager.instance.playerNode)
            || this.node.scene?.getChildByName('Character')
            || null;
        return this._heroNode;
    }

    /**
     * Khóa/mở khóa di chuyển (khi quái vung kiếm đánh hoặc bị choáng)
     */
    public lockMovement(locked: boolean) {  
        this._isMovementLocked = locked;
        if (locked) {
            this._isMoving = false;
        }
    }

    public get isMovementLocked(): boolean {
        return this._isMovementLocked;
    }

    public get isMoving(): boolean {
        return this._isMoving;
    }

    /**
     * Khởi tạo hướng mặt ngay khi quái spawn hoặc tái sử dụng từ Pool
     */
    public initMovement() {
        this.applyConfig();
        this._isMovementLocked = false;
        this._isMoving = false;
        this._smoothMoveDir.set(0, 0, 0);
        this._separationForce.set(0, 0, 0);

        const hero = this.getTarget();
        if (hero && hero.isValid) {
            hero.getWorldPosition(this._heroPos);
            this.node.getWorldPosition(this._myPos);

            const dx = this._heroPos.x - this._myPos.x;
            const dz = this._heroPos.z - this._myPos.z;
            const lenSq = dx * dx + dz * dz;

            if (lenSq > 0.0001) {
                const invLen = 1 / Math.sqrt(lenSq);
                this._toHeroDir.set(dx * invLen, 0, dz * invLen);
                this._smoothMoveDir.set(this._toHeroDir);

                // Model Skeleton chuẩn nhìn theo +Z: Dùng vector dương, Quat.fromViewUp
                Quat.fromViewUp(this._targetRot, this._toHeroDir, Vec3.UP);
                this.node.setWorldRotation(this._targetRot);
            }
        }
    }

    /**
     * Tính toán di chuyển và xoay hướng quái mỗi khung hình
     * @returns boolean true nếu đang di chuyển chạy tới, false nếu dừng cự ly đánh hoặc bị khóa
     */
    public updateMovement(deltaTime: number, isAlive: boolean = true): boolean {
        if (!isAlive) {
            this._isMoving = false;
            return false;
        }

        const hero = this.getTarget();
        if (!hero || !hero.isValid) {
            this._isMoving = false;
            return false;
        }

        this.node.getWorldPosition(this._myPos);
        hero.getWorldPosition(this._heroPos);

        const dx = this._heroPos.x - this._myPos.x;
        const dz = this._heroPos.z - this._myPos.z;
        const distSq = dx * dx + dz * dz;
        const dist = Math.sqrt(distSq);

        // 1. Vector hướng thẳng về phía Hero trên mặt phẳng XZ (luôn bủa vây tiến vào Hero)
        if (dist > 0.0001) {
            this._toHeroDir.set(dx / dist, 0, dz / dist);
        } else {
            this._toHeroDir.set(0, 0, 1);
        }

        // 2. Luôn xoay mặt hướng thẳng về phía Hero (chuẩn model skeleton +Z)
        this._facingDir.set(this._toHeroDir.x, 0, this._toHeroDir.z);
        if (this._facingDir.lengthSqr() > 0.0001) {
            this._facingDir.normalize();
            Quat.fromViewUp(this._targetRot, this._facingDir, Vec3.UP);

            this._currentRot.set(this.node.worldRotation);
            Quat.slerp(this._currentRot, this._currentRot, this._targetRot, Math.min(1, deltaTime * this.rotateSpeed));
            this.node.setWorldRotation(this._currentRot);
        }

        // Nếu bị khóa di chuyển (đang vung kiếm đánh hoặc bị choáng), không di chuyển
        if (this._isMovementLocked) {
            this._isMoving = false;
            return false;
        }

        // 3. Tính lực tự cách nhau giữa các con quái (Bản thân chúng tự cách nhau ra để bủa vây thành vòng)
        let sepX = 0;
        let sepZ = 0;
        const config = EnemyConfig.instance;
        const sepRadius = (config && config.separationRadius > 0) ? config.separationRadius : this.separationRadius;
        const sepForce = (config && config.separationForce > 0) ? config.separationForce : this.separationForce;
        const sepRadiusSq = sepRadius * sepRadius;

        if (EnemyPool.instance && EnemyPool.instance.activeEnemies.length > 1) {
            const enemies = EnemyPool.instance.activeEnemies;
            for (let i = 0; i < enemies.length; i++) {
                const other = enemies[i];
                if (!other || !other.isValid || other === this.node || !other.active) continue;

                other.getWorldPosition(this._otherPos);
                const ox = this._myPos.x - this._otherPos.x;
                const oz = this._myPos.z - this._otherPos.z;
                const odSq = ox * ox + oz * oz;

                if (odSq > 0.0001 && odSq < sepRadiusSq) {
                    const od = Math.sqrt(odSq);
                    const overlap = (sepRadius - od) / sepRadius;
                    // Lực đẩy tách quái kia ra theo phương ngang (tránh đè chồng lên nhau)
                    const push = overlap * sepForce * deltaTime;
                    sepX += (ox / od) * push;
                    sepZ += (oz / od) * push;
                }
            }
        }

        // 4. Kiểm tra cự ly đối với Hero:
        // ĐÚNG YÊU CẦU GD: Quái KHÔNG BAO GIỜ tự chạy ra xa hay lùi lại!
        // Hành vi luôn là bủa vây tiến vào. Khi chạm cự ly dừng stopDistance thì đứng yên chém!
        const stopDist = (config && config.stopDistance > 0) ? config.stopDistance : this.stopDistance;
        const moveSpeed = (config && config.moveSpeed > 0) ? config.moveSpeed : this.moveSpeed;

        if (dist <= stopDist) {
            // Đã áp sát đến cự ly đánh trước Hero:
            // Dừng tiến vào Hero (không đi xuyên người), nhận lực tách nhẹ giữa các quái để giữ vị trí
            if (Math.abs(sepX) > 0.0001 || Math.abs(sepZ) > 0.0001) {
                this._myPos.x += sepX * 0.3;
                this._myPos.z += sepZ * 0.3;
                this.node.setWorldPosition(this._myPos);
            }
            this._isMoving = false;
            return false;
        }

        // 5. Di chuyển tiến thẳng vào Hero kèm lực tách đàn trượt sang 2 bên để bủa vây kín vòng quanh
        let currentSpeed = moveSpeed;
        if (this._pushDampenTimer > 0) {
            this._pushDampenTimer -= deltaTime;
            currentSpeed *= 0.3;
        }

        const advanceDist = currentSpeed * deltaTime;
        const moveX = this._toHeroDir.x * advanceDist + sepX;
        const moveZ = this._toHeroDir.z * advanceDist + sepZ;

        this.node.getWorldPosition(this._myPos);
        this._myPos.x += moveX;
        this._myPos.z += moveZ;
        this.node.setWorldPosition(this._myPos);

        this._isMoving = true;
        return true;
    }

    /**
     * Nhận lực đẩy từ người chơi để quái dạt sang 2 bên và lùi lại khi người chơi luồn lách qua đám đông
     */
    public applyPush(pushX: number, pushZ: number) {
        if (!this.node || !this.node.isValid || !this.node.activeInHierarchy) return;
        this.node.getWorldPosition(this._myPos);
        this._myPos.x += pushX;
        this._myPos.z += pushZ;
        this.node.setWorldPosition(this._myPos);
        this._pushDampenTimer = 0.15;
    }
}
