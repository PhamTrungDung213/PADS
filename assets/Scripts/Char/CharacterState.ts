import { _decorator, Component, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

export enum PlayerStateEnum {
    IDLE = 'IDLE',
    MOVE = 'MOVE',
    AUTO_CHASE = 'AUTO_CHASE',
    ATTACK = 'ATTACK',
    WIN = 'WIN',
}

@ccclass('CharacterState')
export class CharacterState extends Component {
    public currentState: PlayerStateEnum = PlayerStateEnum.IDLE;

    /** Hướng nhìn (Facing) hiện tại của nhân vật trong không gian thế giới 3D */
    public facing: Vec3 = new Vec3(0, 0, -1);

    public setState(newState: PlayerStateEnum) {
        if (this.currentState === newState) return;
        this.currentState = newState;
    }

    public setFacing(dir: Vec3) {
        if (dir && dir.lengthSqr() > 0.001) {
            this.facing.set(dir.x, 0, dir.z).normalize();
        }
    }

    public getFacing(): Vec3 {
        return this.facing;
    }

    public isMoving(): boolean {
        return this.currentState === PlayerStateEnum.MOVE || this.currentState === PlayerStateEnum.AUTO_CHASE;
    }

    public isAttacking(): boolean {
        return this.currentState === PlayerStateEnum.ATTACK;
    }

    public isIdle(): boolean {
        return this.currentState === PlayerStateEnum.IDLE;
    }
}
