import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

export enum EnemyStateEnum {
    SPAWN = 'SPAWN',
    CHASE = 'CHASE',
    ATTACK = 'ATTACK',
    STUN = 'STUN',
    DIE = 'DIE',
}

@ccclass('EnemyState')
export class EnemyState extends Component {
    public currentState: EnemyStateEnum = EnemyStateEnum.SPAWN;

    public setState(newState: EnemyStateEnum) {
        this.currentState = newState;
    }

    public isAlive(): boolean {
        return this.currentState !== EnemyStateEnum.DIE;
    }

    public canMove(): boolean {
        return this.currentState === EnemyStateEnum.CHASE;
    }
}
