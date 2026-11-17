import { _decorator, Component, Node, Vec3, Quat, CCFloat, SpriteRenderer } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';
import { CharacterAnimation } from './CharacterAnimation';
import { CharacterState, PlayerStateEnum } from './CharacterState';
import { CharacterCombat } from './CharacterCombat';
import { CharacterConfig } from '../Config/CharacterConfig';
import { EnemyPool } from '../Enemies/EnemyPool';
import { GameManager } from '../System/GameManager';
import { JoyStick } from '../UI/JoyStick';
import { IslandWallCollision } from '../System/IslandWallCollision';

const { ccclass, property } = _decorator;

@ccclass('CharaterController')
export class CharaterController extends Component {
    @property({ type: CharacterAnimation, tooltip: 'Script điều khiển hoạt ảnh nhân vật' })
    public charAnim: CharacterAnimation = null;

    @property({ type: CharacterState, tooltip: 'Script quản lý trạng thái nhân vật' })
    public charState: CharacterState = null;

    @property({ type: CharacterCombat, tooltip: 'Script chiến đấu của nhân vật' })
    public charCombat: CharacterCombat = null;

    // Các tham số lộ ra ngoài Inspector để bạn thoải mái tinh chỉnh trực tiếp
    @property({ type: CCFloat, tooltip: 'Tốc độ di chuyển khi kéo joystick (m/s)' })
    public moveSpeed: number = 4.0;

    @property({ type: CCFloat, tooltip: 'Tốc độ xoay hướng nhân vật (mịn và chuẩn hướng)' })
    public rotateSpeed: number = 10.0;

    @property({ type: CCFloat, tooltip: 'Tốc độ tự tìm đến quái khi buông joystick (m/s)' })
    public autoChaseSpeed: number = 3.0;

    @property({ type: CCFloat, tooltip: 'Tầm đánh cận chiến để dừng lại chém (mét)' })
    public attackRange: number = 1.5;

    // --- CẤU HÌNH DẠT QUÁI (CROWD SHOVING) ---
    @property({ type: CCFloat, tooltip: 'Khoảng cách / Bán kính dạt quái khi người chơi di chuyển (mét)' })
    public pushRadius: number = 1.8;

    @property({ type: CCFloat, tooltip: 'Hệ số lực đẩy dạt quái sang 2 bên khi di chuyển' })
    public pushStrength: number = 1.6;

    @property({ type: CCFloat, tooltip: 'Khoảng cách dạt giữ cự ly an toàn khi nhân vật đứng yên (mét)' })
    public personalSpace: number = 0.75;

    @property({ type: Node, tooltip: 'Kéo Node xương gốc (Hips/Root_M/Bip01) của Model vào đây' })
    public rootBone: Node = null!;

    private _isManualMoving: boolean = false;
    private _manualMoveDir: Vec3 = new Vec3();
    private _moveDir: Vec3 = new Vec3();
    private _currentPos: Vec3 = new Vec3();
    private _targetPos: Vec3 = new Vec3();
    private _targetRot: Quat = new Quat();
    private _currentRot: Quat = new Quat();
    private _displacement: Vec3 = new Vec3();
    private _shadowNode: Node | null = null;
    private _logTimer: number = 0;

    onLoad() {
        if (!this.charAnim) this.charAnim = this.getComponent(CharacterAnimation);
        if (!this.charState) this.charState = this.getComponent(CharacterState);
        if (!this.charCombat) this.charCombat = this.getComponent(CharacterCombat);

        // Khởi tạo bộ cản tường đảo OBB nếu chưa có trong scene
        const scene = this.node.scene || this.node;
        if (!IslandWallCollision.instance && scene) {
            scene.addComponent(IslandWallCollision);
        }

        this.applyConfig();

        EventManager.instance.on(GameEvent.JOYSTICK_MOVE, this.onJoystickMove, this);
        EventManager.instance.on(GameEvent.JOYSTICK_STOP, this.onJoystickStop, this);
    }

    public applyConfig() {
        const config = CharacterConfig.instance;
        if (config) {
            if (config.moveSpeed > 0) this.moveSpeed = config.moveSpeed;
            if (config.rotateSpeed > 0) this.rotateSpeed = config.rotateSpeed;
            if (config.attackRange > 0) this.attackRange = config.attackRange;
            if (config.pushRadius > 0) this.pushRadius = config.pushRadius;
            if (config.pushStrength > 0) this.pushStrength = config.pushStrength;
            if (config.personalSpace > 0) this.personalSpace = config.personalSpace;
        }
    }

    start() {
        this._resolveShadowNode();
        this._resolveRootBone();
    }

    private _resolveRootBone() {
        if (this.rootBone && this.rootBone.isValid) return;
        // Tự động tìm xương gốc Root_M / Root / Hips / Bip01 / pelvis trong cây node nhân vật
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

    private _resolveShadowNode() {
        // Tìm node shadow bằng SpriteRenderer hoặc đường dẫn chuẩn
        const sp = this.node.getComponentInChildren(SpriteRenderer);
        if (sp && sp.node && sp.node.isValid) {
            this._shadowNode = sp.node;
        } else {
            this._shadowNode = this.node.getChildByPath('P_Paladin/shadow')
                || this.node.getChildByName('shadow');
        }

        if (this._shadowNode && this._shadowNode.isValid) {
            // MẤU CHỐT: Vô hiệu hóa cờ skip transform update mà SkeletalAnimation (Baked) tự gán lên children
            // Giúp Scene Graph Cocos Creator cập nhật ma trận thế giới của Shadow 1:1 đồng bộ tuyệt đối theo nhân vật
            (this._shadowNode as any).isSkipTransformUpdate = false;
        }
    }

    onDestroy() {
        EventManager.instance.off(GameEvent.JOYSTICK_MOVE, this.onJoystickMove, this);
        EventManager.instance.off(GameEvent.JOYSTICK_STOP, this.onJoystickStop, this);
    }

    /**
     * Kiểm tra xem nhân vật có đang bị khóa bởi đòn đánh hay không
     * THEO ĐÚNG YÊU CẦU GD: Khi đánh thì khóa hết các hành động khác!
     */
    public isActionLocked(): boolean {
        return (this.charCombat && this.charCombat.isAttacking())
            || (this.charAnim && this.charAnim.isBusy());
    }

    /**
     * Dừng mọi hành động đang thực hiện (chém kiếm, trúng đòn...) ngay lập tức để ưu tiên di chuyển
     */
    public interruptActionsForMovement() {
        if (this.charCombat && this.charCombat.isAttacking()) {
            this.charCombat.cancelAttack(true);
        }
        if (this.charAnim && this.charAnim.isBusy()) {
            this.charAnim.unlock();
        }
    }

    /**
     * Khi người chơi kéo Joystick:
     * Lập tức dừng mọi hành động khác (đang đánh, chờ...) để phản hồi di chuyển ngay lập tức
     */
    private onJoystickMove(dir: { x: number; y: number }) {
        if (GameManager.instance && GameManager.instance.isPaused) {
            this.onJoystickStop();
            return;
        }

        this._isManualMoving = true;

        // Quy đổi hướng 2D UI sang 3D World (Y lên ứng với -Z tới theo chuẩn TestController)
        this._manualMoveDir.set(dir.x, 0, -dir.y).normalize();

        // KHI CÓ TÍN HIỆU DI CHUYỂN: LẬP TỨC DỪNG MỌI HÀNH ĐỘNG ĐANG ĐÁNH/CHỜ ĐỂ DI CHUYỂN
        this.interruptActionsForMovement();

        if (this.charState) {
            this.charState.setFacing(this._manualMoveDir);
            this.charState.setState(PlayerStateEnum.MOVE);
        }

        if (this.charAnim) {
            this.charAnim.playRun();
        }
    }

    /**
     * Khi dừng di chuyển Joystick
     */
    private onJoystickStop() {
        // Nếu người chơi vẫn đang chạm ngón tay trên màn hình (đang lướt đổi hướng qua tâm), KHÔNG buông tay
        const isStillHolding = JoyStick.instance ? JoyStick.instance.isHolding : false;
        if (isStillHolding) {
            this._manualMoveDir.set(0, 0, 0);
            return;
        }

        this._isManualMoving = false;
        this._manualMoveDir.set(0, 0, 0);

        if (this.charState) {
            this.charState.setState(PlayerStateEnum.IDLE);
        }
        if (this.charAnim) {
            this.charAnim.playIdle();
        }
    }

    update(deltaTime: number) {
        if (GameManager.instance && GameManager.instance.isPaused) return;

        // Kiểm tra xem ngón tay người chơi có đang chạm giữ Joystick hay không
        const isHolding = JoyStick.instance ? JoyStick.instance.isHolding : false;
        const joy = JoyStick.instance ? JoyStick.instance.inputDir : null;

        if (isHolding) {
            this._isManualMoving = true;
            this.interruptActionsForMovement();
            if (joy && joy.lengthSqr() > 0.0001) {
                this._manualMoveDir.set(joy.x, 0, -joy.y).normalize();
            } else {
                this._manualMoveDir.set(0, 0, 0);
            }
        } else if (this._isManualMoving) {
            // Người chơi đã thực sự buông tay khỏi màn hình
            this._isManualMoving = false;
            this._manualMoveDir.set(0, 0, 0);
            if (this.charAnim) {
                this.charAnim.playIdle();
            }
        }

        // ==============================================================
        // 1. NGƯỜI CHƠI ĐANG KÉO JOYSTICK (ƯU TIÊN TUYỆT ĐỐI - NGẮT MỌI HÀNH ĐỘNG KHÁC)
        // ==============================================================
        if (this._isManualMoving && this._manualMoveDir.lengthSqr() > 0.0001) {
            this._moveDir.set(this._manualMoveDir);

            // Xoay mặt (Facing): Đảo dấu vector bù góc 180 độ model chuẩn TestController
            const facingDir = new Vec3(-this._moveDir.x, 0, -this._moveDir.z);
            Quat.fromViewUp(this._targetRot, facingDir, Vec3.UP);

            this._currentRot.set(this.node.worldRotation);

            // Đảm bảo slerp luôn đi theo cung ngắn nhất, tránh quay vòng 360 độ gây giật/đơ
            if (Quat.dot(this._currentRot, this._targetRot) < 0) {
                this._targetRot.set(-this._targetRot.x, -this._targetRot.y, -this._targetRot.z, -this._targetRot.w);
            }

            // Tốc độ xoay mặt nhạy, mượt mà và dứt khoát
            const rotSpeed = Math.max(this.rotateSpeed, 20.0);
            Quat.slerp(this._currentRot, this._currentRot, this._targetRot, Math.min(1, deltaTime * rotSpeed));
            this.node.setWorldRotation(this._currentRot);

            if (this.charAnim) {
                this.charAnim.playRun();
            }

            // 1. ĐẨY QUÁI RẼ SANG 2 BÊN TRƯỚC ĐỂ MỞ THÔNG ĐƯỜNG TIẾN
            this._pushNearbyEnemies(deltaTime, true);

            // 2. DI CHUYỂN BẰNG CAPSULE CONTROLLER (VẪN BỊ CHẶN BỞI BLOCK1 VÀ CHƯỚNG NGẠI VẬT)
            this._displacement.set(
                this._moveDir.x * this.moveSpeed * deltaTime,
                0,
                this._moveDir.z * this.moveSpeed * deltaTime
            );

            this._applyDisplacement(this._displacement);
            return;
        } else if (this._isManualMoving) {
            // Ngón tay đang giữ trên Joystick nhưng ở vùng chết (deadzone)
            // Đứng yên tại chỗ, không tự tìm quái
            this._moveDir.set(0, 0, 0);
            if (this.charAnim) {
                this.charAnim.playIdle();
            }
            return;
        }

        // ==============================================================
        // 2. KHI BUÔNG TAY:
        //    - NẾU ĐANG CHÉM DỞ: ĐỂ ĐÒN ĐÁNH TỰ HOÀN TẤT
        //    - NẾU KHÔNG CÒN DI CHUYỂN: ĐỨNG YÊN TẠI CHỖ (BỎ TỰ ĐUỔI ĐỊCH)
        // ==============================================================
        if (this.isActionLocked()) {
            this._moveDir.set(0, 0, 0);
            return;
        }

        // ==============================================================
        // 2. KHI BUÔNG TAY: ĐỨNG YÊN TẠI CHỖ (BỎ HOÀN TOÀN TỰ ĐUỔI ĐỊCH)
        //    - CHỈ TẤN CÔNG NẾU QUÁI ĐÃ Ở TRONG TẦM ĐÁNH CẬN CHIẾN
        //    - TUYỆT ĐỐI KHÔNG TỰ CHẠY BĂNG QUA MAP ĐUỔI THEO QUÁI
        // ==============================================================
        if (!this._isManualMoving) {
            this._moveDir.set(0, 0, 0);

            this.node.getWorldPosition(this._currentPos);
            this._currentPos.y = 0;

            const effectiveAttackRange = this.charCombat ? this.charCombat.attackRange : this.attackRange;

            // Chỉ tìm quái đã nằm ngay trong tầm cận chiến
            const targetEnemy = EnemyPool.instance
                ? EnemyPool.instance.findTargetEnemy(this._currentPos, effectiveAttackRange, effectiveAttackRange)
                : null;

            if (targetEnemy && targetEnemy.isValid) {
                // Quái đã vào trong tầm đánh: Xoay mặt về phía quái và tung đòn đánh tại chỗ
                targetEnemy.getWorldPosition(this._targetPos);
                this._targetPos.y = 0;

                const dx = this._targetPos.x - this._currentPos.x;
                const dz = this._targetPos.z - this._currentPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist > 0.001) {
                    const facingDir = new Vec3(-dx / dist, 0, -dz / dist);
                    Quat.fromViewUp(this._targetRot, facingDir, Vec3.UP);
                    this.node.setWorldRotation(this._targetRot);
                }

                if (this.charCombat) {
                    this.charCombat.executeAttack(targetEnemy);
                }
            } else {
                // Không có quái trong tầm đánh: Đứng yên Idle ngay tại chỗ, không chạy đi đâu
                const isCurrentlyAttacking = this.charCombat && this.charCombat.isAttacking();
                if (!isCurrentlyAttacking) {
                    if (this.charState && !this.charState.isIdle()) {
                        this.charState.setState(PlayerStateEnum.IDLE);
                    }
                    if (this.charAnim && !this.charAnim.isIdle()) {
                        this.charAnim.playIdle();
                    }
                }
            }
            // Đứng yên vẫn giữ khoảng cách cản quái không lấn xuyên người
            this._pushNearbyEnemies(deltaTime, false);
        }
    }

    private _applyDisplacement(disp: Vec3) {
        this.node.getWorldPosition(this._currentPos);
        const targetX = this._currentPos.x + disp.x;
        const targetZ = this._currentPos.z + disp.z;

        // Cản va chạm và trượt theo 13 khối tường bao quanh đảo (OBB)
        const resolved = IslandWallCollision.resolve(targetX, targetZ, 0.5);
        this._currentPos.x = resolved.x;
        this._currentPos.z = resolved.z;
        this._currentPos.y = 0;
        this.node.setWorldPosition(this._currentPos);
    }

    /**
     * ĐẨY QUÁI RẼ SANG 2 BÊN VÀ LÙI RA KHI NGƯỜI CHƠI DI CHUYỂN
     * Quét rộng bán kính 1.8m, đẩy toàn bộ đám đông phía trước dạt sang 2 bên
     * Cho phép Paladin rẽ sóng luồn lách xuyên qua bất kỳ lượng quái nào dù đông đến đâu
     */
    private _pushNearbyEnemies(deltaTime: number, isMoving: boolean) {
        if (!EnemyPool.instance) return;
        const enemies = EnemyPool.instance.activeEnemies;
        if (!enemies || enemies.length === 0) return;

        this.node.getWorldPosition(this._currentPos);

        const pushRadius = (CharacterConfig.instance && CharacterConfig.instance.pushRadius > 0)
            ? CharacterConfig.instance.pushRadius
            : this.pushRadius;
        const pushStrength = (CharacterConfig.instance && CharacterConfig.instance.pushStrength > 0)
            ? CharacterConfig.instance.pushStrength
            : this.pushStrength;
        const personalSpace = (CharacterConfig.instance && CharacterConfig.instance.personalSpace > 0)
            ? CharacterConfig.instance.personalSpace
            : this.personalSpace;

        if (isMoving) {
            // Khi di chuyển: Quét theo bán kính dạt quái phía trước và xung quanh để dọn đường
            const pushRadiusSq = pushRadius * pushRadius;

            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (!enemy || !enemy.isValid || !enemy.activeInHierarchy) continue;

                enemy.getWorldPosition(this._targetPos);
                const dx = this._targetPos.x - this._currentPos.x;
                const dz = this._targetPos.z - this._currentPos.z;
                const distSq = dx * dx + dz * dz;

                if (distSq > 0.0001 && distSq < pushRadiusSq) {
                    const dist = Math.sqrt(distSq);
                    const normX = dx / dist;
                    const normZ = dz / dist;

                    // Tỉ lệ khoảng cách: Càng gần người chơi đẩy càng dứt khoát
                    const overlap = (pushRadius - dist) / pushRadius;

                    // Chiếu lên hướng di chuyển
                    const forwardDot = this._moveDir.x * normX + this._moveDir.z * normZ;

                    // Vector vuông góc (rẽ 2 bên)
                    const latX = normX - this._moveDir.x * forwardDot;
                    const latZ = normZ - this._moveDir.z * forwardDot;
                    const latLen = Math.sqrt(latX * latX + latZ * latZ);

                    let latNormX = 0;
                    let latNormZ = 0;
                    if (latLen > 0.01) {
                        latNormX = latX / latLen;
                        latNormZ = latZ / latLen;
                    } else {
                        // Nếu quái nằm chính xác 100% thẳng hướng tiến: Tự tách sang 2 bên
                        latNormX = -this._moveDir.z;
                        latNormZ = this._moveDir.x;
                    }

                    let pushDirX = normX;
                    let pushDirZ = normZ;

                    if (forwardDot > -0.2) {
                        // Quái ở phía trước hoặc 2 bên sườn: 75% rẽ sang 2 bên và 25% lùi lại -> tạo luồng rẽ sóng
                        pushDirX = latNormX * 0.75 + normX * 0.25;
                        pushDirZ = latNormZ * 0.75 + normZ * 0.25;
                    } else {
                        // Quái phía sau lưng: Đẩy nhẹ hướng tâm ra xa
                        pushDirX = normX;
                        pushDirZ = normZ;
                    }

                    const pushDirLen = Math.sqrt(pushDirX * pushDirX + pushDirZ * pushDirZ);
                    if (pushDirLen > 0.001) {
                        pushDirX /= pushDirLen;
                        pushDirZ /= pushDirLen;
                    }

                    // Vận tốc đẩy: Đảm bảo quái dạt nhanh hơn vận tốc chạy của Hero
                    const shoveDist = (this.moveSpeed * pushStrength + overlap * 4.5) * deltaTime;
                    const shoveX = pushDirX * shoveDist;
                    const shoveZ = pushDirZ * shoveDist;

                    const enemyMovement = enemy.getComponent('EnemyMovement') as any;
                    if (enemyMovement && typeof enemyMovement.applyPush === 'function') {
                        enemyMovement.applyPush(shoveX, shoveZ);
                    } else {
                        this._targetPos.x += shoveX;
                        this._targetPos.z += shoveZ;
                        this._targetPos.y = 0;
                        enemy.setWorldPosition(this._targetPos);
                    }
                }
            }
        } else {
            // Khi đứng yên Idle: Đảm bảo giữ khoảng cách tối thiểu personalSpace để quái không lấn xuyên người
            const personalRadius = personalSpace;
            const personalRadiusSq = personalRadius * personalRadius;

            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (!enemy || !enemy.isValid || !enemy.activeInHierarchy) continue;

                enemy.getWorldPosition(this._targetPos);
                const dx = this._targetPos.x - this._currentPos.x;
                const dz = this._targetPos.z - this._currentPos.z;
                const distSq = dx * dx + dz * dz;

                if (distSq > 0.0001 && distSq < personalRadiusSq) {
                    const dist = Math.sqrt(distSq);
                    const normX = dx / dist;
                    const normZ = dz / dist;
                    const shoveDist = (personalRadius - dist) * 4.0 * deltaTime;

                    const shoveX = normX * shoveDist;
                    const shoveZ = normZ * shoveDist;

                    const enemyMovement = enemy.getComponent('EnemyMovement') as any;
                    if (enemyMovement && typeof enemyMovement.applyPush === 'function') {
                        enemyMovement.applyPush(shoveX, shoveZ);
                    } else {
                        this._targetPos.x += shoveX;
                        this._targetPos.z += shoveZ;
                        this._targetPos.y = 0;
                        enemy.setWorldPosition(this._targetPos);
                    }
                }
            }
        }
    }

    lateUpdate(deltaTime: number) {
        if (!this._shadowNode || !this._shadowNode.isValid) {
            this._resolveShadowNode();
        }
        if (this._shadowNode && this._shadowNode.isValid) {
            // Đảm bảo cờ skip transform update luôn là false
            (this._shadowNode as any).isSkipTransformUpdate = false;

            // Nếu shadow nằm dưới P_Paladin (P_Paladin có local y = 0.12), đặt local y = -0.1 để world y = 0.02 sát mặt sàn
            // Nếu shadow nằm trực tiếp dưới Character (Character y = 0), đặt local y = 0.02
            const isChildOfPaladin = this._shadowNode.parent && this._shadowNode.parent !== this.node;
            const targetY = isChildOfPaladin ? -0.1 : 0.02;

            const p = this._shadowNode.position;
            if (p.x !== 0 || p.z !== 0 || Math.abs(p.y - targetY) > 0.005) {
                this._shadowNode.setPosition(0, targetY, 0);
            }
        }
    }
}
