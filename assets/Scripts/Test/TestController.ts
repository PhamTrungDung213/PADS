import { _decorator, Component, Node, Vec3, Quat, CapsuleCharacterController, SkeletalAnimation } from 'cc';
import { SkeletalAnimationTester } from './AnimTest';
import { Joystick } from './JoyStick'; 
const { ccclass, property } = _decorator;

// 1. Khai báo các trạng thái Enum
export enum AnimState {
    IDLE = 'IDLE',
    RUN = 'RUN',
    ATTACK = 'ATTACK',
    HIT = 'HIT',
    DIE = 'DIE',
}

// 2. Dictionary ánh xạ sang tên clip của bộ 1H
const ANIM_1H_DICT: Record<AnimState, string> = {
    [AnimState.IDLE]: 'paladin_1h_idle',
    [AnimState.RUN]: 'paladin_1h_run',
    [AnimState.ATTACK]: 'paladin_1h_attack', 
    [AnimState.HIT]: 'paladin_1h_get_hit',  
    [AnimState.DIE]: 'paladin_1h_die',
};

@ccclass('TestController')
export class TestController extends Component {
    @property({ tooltip: 'Tốc độ di chuyển cố định (m/s)' })
    public moveSpeed: number = 4.0;

    @property({ tooltip: 'Tốc độ xoay hướng nhân vật' })
    public rotateSpeed: number = 10.0;

    @property({ type: Node, tooltip: 'Kéo Node xương gốc (Hips/Root/Bip01) của Model vào đây' })
    public rootBone: Node = null!;

    private _controller: CapsuleCharacterController | null = null;
    private _currentState: AnimState = AnimState.IDLE;
    private _isLocked: boolean = false; // Khóa di chuyển khi ra đòn đánh

    // Vector tính toán di chuyển & xoay
    private _moveDir: Vec3 = new Vec3();
    private _targetRot: Quat = new Quat();
    private _currentRot: Quat = new Quat();
    private _displacement: Vec3 = new Vec3();

    onLoad() {
        this._controller = this.getComponent(CapsuleCharacterController);
        if (this._controller) {
            this._controller.enabled = false;
        }
    }

    start() {
        this._resolveRootBone();
        // Khởi đầu với anim Idle 1H (playOnce = false để lặp liên tục)
        this.playState(AnimState.IDLE, false);
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

    update(dt: number) {
        this._processMovement(dt);
        this._updateAnimationLogic();
    }

    lateUpdate(dt: number) {
        if (!this.rootBone || !this.rootBone.isValid) {
            this._resolveRootBone();
        }

        // Ép vị trí X và Z của xương gốc luôn về 0 trong toạ độ local của nó
        // Chỉ giữ lại Y (độ nhấp nhô khi bước đi)
        if (this.rootBone && this.rootBone.isValid) {
            const curPos = this.rootBone.position;
            if (curPos.x !== 0 || curPos.z !== 0) {
                this.rootBone.setPosition(0, curPos.y, 0);
            }
        }
    }

    /**
     * 1. Lấy hướng từ Joystick và di chuyển phẳng (Y = 0)
     */
    private _processMovement(dt: number) {
        // Lấy vector điều hướng 2D từ Joystick (x: ngang, y: dọc)
        const joy = Joystick.instance ? Joystick.instance.inputDir : null;

        if (joy && joy.lengthSqr() > 0.0001) {
            // Khi có tín hiệu di chuyển từ Joystick: Lập tức hủy mọi khóa đánh để ưu tiên di chuyển
            this._isLocked = false;

            // Quy đổi 2D UI sang 3D World: UI Y đi lên tương ứng 3D -Z đi tới
            this._moveDir.set(joy.x, 0, -joy.y);
            this._moveDir.normalize();

            // Xoay mặt (Facing): Đảo dấu vector để bù trừ góc 180 độ của model
            const facingDir = new Vec3(-this._moveDir.x, 0, -this._moveDir.z);
            Quat.fromViewUp(this._targetRot, facingDir, Vec3.UP);

            this._currentRot.set(this.node.worldRotation);
            if (Quat.dot(this._currentRot, this._targetRot) < 0) {
                this._targetRot.set(-this._targetRot.x, -this._targetRot.y, -this._targetRot.z, -this._targetRot.w);
            }
            const rotSpeed = Math.max(this.rotateSpeed, 20.0);
            Quat.slerp(this._currentRot, this._currentRot, this._targetRot, Math.min(1, dt * rotSpeed));
            this.node.setWorldRotation(this._currentRot);
        } else {
            if (this._isLocked) {
                this._moveDir.set(0, 0, 0);
                return;
            }
            this._moveDir.set(0, 0, 0);
        }

        // Di chuyển với vận tốc cố định moveSpeed (bỏ Shift, Y luôn = 0)
        this._displacement.set(
            this._moveDir.x * this.moveSpeed * dt,
            0,
            this._moveDir.z * this.moveSpeed * dt
        );

        if (this._displacement.lengthSqr() > 0.000001) {
            const startPos = new Vec3();
            this.node.getWorldPosition(startPos);
            startPos.x += this._displacement.x;
            startPos.z += this._displacement.z;
            startPos.y = 0;
            this.node.setWorldPosition(startPos);
        }
    }

    /**
     * 2. Tự động chuyển đổi giữa IDLE và RUN
     */
    private _updateAnimationLogic() {
        if (this._isLocked) return;

        const isMoving = this._moveDir.lengthSqr() > 0.0001;
        if (isMoving) {
            this.playState(AnimState.RUN, false);
        } else {
            this.playState(AnimState.IDLE, false);
        }
    }

    /**
     * 3. Gọi animation qua SkeletalAnimationTester.instance
     */
    public playState(state: AnimState, playOnce: boolean) {
        if (this._currentState === state && !this._isLocked) return;

        const clipName = ANIM_1H_DICT[state];
        if (!clipName) return;

        this._currentState = state;

        if (SkeletalAnimationTester.instance) {
            const tester = SkeletalAnimationTester.instance as any;
            // Gọi hàm playAnimation (hoặc playAnimationByIndex tuỳ tên hàm bạn đã lưu trong AnimTest)
            if (typeof tester.playAnimation === 'function') {
                tester.playAnimation(clipName, playOnce);
            } else if (typeof tester.playAnimationByIndex === 'function') {
                tester.playAnimationByIndex(clipName, playOnce);
            }
        }
    }

    /**
     * Tấn công: Gắn trực tiếp hàm này vào sự kiện Click của nút Attack UI trên Canvas
     */
    public attack() {
        if (this._isLocked) return;

        const tester = SkeletalAnimationTester.instance;
        if (!tester || !tester.animComp) return;

        this._isLocked = true;
        this.playState(AnimState.ATTACK, true);

        // Chờ kết thúc đòn chém để mở khóa di chuyển
        tester.animComp.once(SkeletalAnimation.EventType.FINISHED, () => {
            this._isLocked = false;
            this._updateAnimationLogic();
        });
    }
}