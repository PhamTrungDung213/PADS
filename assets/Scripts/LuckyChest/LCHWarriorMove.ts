import { _decorator, Component, Vec2, Vec3, input, Input, EventKeyboard, KeyCode, tween, Tween } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';
import { JoyStick } from '../UI/JoyStick';
import { LCHConfig } from './LCHConfig';
import { LCHRoomBoundary } from './LCHRoomBoundary';
import { LCHWarriorStats } from './LCHWarriorStats';
import { LCHWarriorAnim } from './LCHWarriorAnim';
import { LCHEnemyStats } from './LCHEnemyStats';

const { ccclass, property } = _decorator;

@ccclass('LCHWarriorMove')
export class LCHWarriorMove extends Component {
    @property({ type: LCHWarriorStats, tooltip: 'Component thông số LCHWarriorStats trên cùng nhân vật' })
    public stats: LCHWarriorStats = null;

    @property({ type: LCHWarriorAnim, tooltip: 'Component hoạt ảnh LCHWarriorAnim trên cùng nhân vật' })
    public anim: LCHWarriorAnim = null;

    @property({ type: JoyStick, tooltip: 'Component JoyStick (UI/Control/JoyStick)' })
    public joyStick: JoyStick = null;

    @property({ type: LCHRoomBoundary, tooltip: 'Giới hạn tường phòng LCHRoomBoundary' })
    public boundary: LCHRoomBoundary = null;

    @property({ type: LCHConfig, tooltip: 'File cấu hình LCHConfig (System/Config)' })
    public config: LCHConfig = null;

    public isMovingInput: boolean = false;
    public isPerformingAttack: boolean = false;
    public isIntroWalking: boolean = false;
    public isControlLocked: boolean = false;
    public facingDir: Vec3 = new Vec3(0, 0, -1);

    private _joystickDir: Vec2 = new Vec2();
    private _keyState: { [key: number]: boolean } = {};
    private _moveDir3D: Vec3 = new Vec3();
    private _myPos: Vec3 = new Vec3();
    private _enemyPos: Vec3 = new Vec3();

    protected onLoad(): void {
        if (this.stats) {
            this.stats.onLockControlCallback = (locked: boolean) => this.setControlLocked(locked);
        }
        EventManager.instance.on(GameEvent.JOYSTICK_MOVE, this.onJoystickMove, this);
        EventManager.instance.on(GameEvent.JOYSTICK_STOP, this.onJoystickStop, this);
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    protected onDestroy(): void {
        EventManager.instance.off(GameEvent.JOYSTICK_MOVE, this.onJoystickMove, this);
        EventManager.instance.off(GameEvent.JOYSTICK_STOP, this.onJoystickStop, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    public setControlLocked(locked: boolean): void {
        this.isControlLocked = locked;
        if (locked) {
            this._joystickDir.set(0, 0);
            this._moveDir3D.set(0, 0, 0);
            this.isMovingInput = false;
        }
        if (this.joyStick) {
            this.joyStick.setInputLocked(locked);
        }
    }

    public playIntroWalk(startPos: Vec3, targetPos: Vec3, duration: number, onComplete?: () => void): void {
        this.isIntroWalking = true;
        this.setControlLocked(true);

        Tween.stopAllByTarget(this.node);
        this.node.setWorldPosition(startPos);
        this.facingDir.set(0, 0, -1);
        this.node.setRotationFromEuler(0, 180, 0);

        if (this.anim) {
            this.anim.playAnim('run', true);
        }

        tween(this.node)
            .to(duration, { worldPosition: targetPos }, { easing: 'quadOut' })
            .call(() => {
                this.node.setWorldPosition(targetPos);
                this.isIntroWalking = false;
                if (this.anim) {
                    this.anim.playAnim('idle', true);
                }
                if (onComplete) onComplete();
            })
            .start();
    }

    private onJoystickMove(dir: Vec2): void {
        if (this.isControlLocked || (this.stats && !this.stats.isAlive)) {
            this._joystickDir.set(0, 0);
            return;
        }
        this._joystickDir.set(dir.x, dir.y);
    }

    private onJoystickStop(): void {
        this._joystickDir.set(0, 0);
    }

    private onKeyDown(event: EventKeyboard): void {
        this._keyState[event.keyCode] = true;
    }

    private onKeyUp(event: EventKeyboard): void {
        this._keyState[event.keyCode] = false;
    }

    protected update(dt: number): void {
        if (this.stats && !this.stats.isAlive) return;

        if (this.isIntroWalking) {
            if (this.anim) this.anim.updateFootstep(dt, true, this.facingDir);
            return;
        }

        let moveX = 0;
        let moveZ = 0;
        if (!this.isControlLocked) {
            moveX = this._joystickDir.x;
            moveZ = -this._joystickDir.y;

            if (Math.abs(moveX) < 0.01 && Math.abs(moveZ) < 0.01) {
                if (this._keyState[KeyCode.KEY_A] || this._keyState[KeyCode.ARROW_LEFT]) moveX -= 1;
                if (this._keyState[KeyCode.KEY_D] || this._keyState[KeyCode.ARROW_RIGHT]) moveX += 1;
                if (this._keyState[KeyCode.KEY_W] || this._keyState[KeyCode.ARROW_UP]) moveZ -= 1;
                if (this._keyState[KeyCode.KEY_S] || this._keyState[KeyCode.ARROW_DOWN]) moveZ += 1;
            }
        }

        const hasManualInput = (moveX * moveX + moveZ * moveZ) > 0.002;
        this.node.getWorldPosition(this._myPos);

        // Nếu người chơi không kéo Joystick và trong phòng đang có địch -> Tự động tìm tới địch để đánh
        if (!hasManualInput && !this.isControlLocked && !this.isPerformingAttack) {
            const targetEnemy = this.findNearestActiveEnemy();
            if (targetEnemy) {
                targetEnemy.node.getWorldPosition(this._enemyPos);
                const dx = this._enemyPos.x - this._myPos.x;
                const dz = this._enemyPos.z - this._myPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const stopRange = (this.stats ? this.stats.attackRange : 1.8) * 0.82;

                if (dist > stopRange) {
                    moveX = dx / dist;
                    moveZ = dz / dist;
                }
            }
        }

        this.isMovingInput = (moveX * moveX + moveZ * moveZ) > 0.002;
        const cfg = this.config || LCHConfig.instance;
        const moveSpeed = cfg ? cfg.moveSpeed : 4.5;

        if (this.isMovingInput) {
            const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
            this._moveDir3D.set(moveX / len, 0, moveZ / len);
            this.facingDir.set(this._moveDir3D);

            this._myPos.x += this._moveDir3D.x * moveSpeed * dt;
            this._myPos.z += this._moveDir3D.z * moveSpeed * dt;
            if (this.boundary) {
                this.boundary.clampPosition(this._myPos);
            }
            this.node.setWorldPosition(this._myPos);

            const targetYaw = Math.atan2(this.facingDir.x, this.facingDir.z) * (180 / Math.PI);
            this.node.setRotationFromEuler(0, targetYaw, 0);

            if (this.anim) {
                this.anim.playAnim('run', true);
                this.anim.updateFootstep(dt, true, this.facingDir);
            }
            this.pushEnemiesWhileMoving(dt);
        } else {
            if (this.anim) {
                this.anim.updateFootstep(dt, false, this.facingDir);
            }
            this.keepPersonalSpaceWhileIdle(dt);
        }
    }

    private findNearestActiveEnemy(): LCHEnemyStats | null {
        const list = LCHEnemyStats.activeList;
        let best: LCHEnemyStats = null;
        let bestDistSq = 999999;

        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e || !e.isAlive || !e.isCombatActive) continue;
            e.node.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - this._myPos.x;
            const dz = this._enemyPos.z - this._myPos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                best = e;
            }
        }
        return best;
    }

    private pushEnemiesWhileMoving(dt: number): void {
        const cfg = this.config || LCHConfig.instance;
        const pushRadius = cfg ? cfg.pushRadius : 1.6;
        const pushStrength = cfg ? cfg.pushStrength : 1.5;
        const moveSpeed = cfg ? cfg.moveSpeed : 4.5;

        this.node.getWorldPosition(this._myPos);
        const list = LCHEnemyStats.activeList;
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e || !e.isAlive || !e.onKnockbackCallback) continue;
            e.node.getWorldPosition(this._enemyPos);
            const rx = this._enemyPos.x - this._myPos.x;
            const rz = this._enemyPos.z - this._myPos.z;
            const distSq = rx * rx + rz * rz;
            if (distSq >= pushRadius * pushRadius || distSq < 0.0001) continue;

            const dist = Math.sqrt(distSq);
            const falloff = (pushRadius - dist) / pushRadius;
            const pushSpeed = moveSpeed * pushStrength * falloff;
            e.onKnockbackCallback((rx / dist) * pushSpeed * dt, (rz / dist) * pushSpeed * dt);
        }
    }

    private keepPersonalSpaceWhileIdle(dt: number): void {
        const cfg = this.config || LCHConfig.instance;
        const space = cfg ? cfg.personalSpace : 0.75;
        this.node.getWorldPosition(this._myPos);
        const list = LCHEnemyStats.activeList;

        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e || !e.isAlive || !e.onKnockbackCallback) continue;
            e.node.getWorldPosition(this._enemyPos);
            const rx = this._enemyPos.x - this._myPos.x;
            const rz = this._enemyPos.z - this._myPos.z;
            const distSq = rx * rx + rz * rz;
            if (distSq >= space * space || distSq < 0.0001) continue;

            const dist = Math.sqrt(distSq);
            const push = (space - dist) * 4.0 * dt;
            e.onKnockbackCallback((rx / dist) * push, (rz / dist) * push);
        }
    }
}
