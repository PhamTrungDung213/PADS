import { Component, Node } from 'cc';

export class SoundManager {
    public static instance: any = null;
    public playHeroAttack(arg1?: any, arg2?: any, arg3?: any): any { return true; }
}

export class CharacterFacing {
    public static lookAtXZ(node: any, pos: any): any { return true; }
}

export class CharacterStats extends Component {
    public hp: number = 100;
    public damage: number = 20;
    public attackCooldown: number = 1.0;
    public meleeRange: number = 2.0;
    public isDead: boolean = false;
    public addAttackSpeedPercent(percent: number): any {}
}

export class GameplayLog {
    public static log(tag: string, msg: string) {}
}

export enum GameState {
    Playing = 0,
    Paused = 1,
    Over = 2,
}

export class GameManager {
    public static instance: any = null;
    public state: GameState = GameState.Playing;
}

export enum AnimState {
    Idle = 0,
    Move = 1,
    Attack = 2,
}

export class PlayerAnimation extends Component {
    public play(state: AnimState, flag?: any): any { return true; }
}

export class PlayerController extends Component {
    public facingNode: Node = null;
    public cameraNode: Node = null;
    public isMoving: boolean = false;
}

export class DamageDealer {
    public static apply(targetStats: any, dmg: number, sourceStats?: any): any {}
}

export class EnemyController extends Component {
    public static all: EnemyController[] = [];
    public stats: any;
    public isDead: boolean = false;
    public isAlive: boolean = true;
    public hitRadius: number = 1.0;
}

export class WA_EnemyStatus extends Component {
    public static of(node: any): any { return null; }
    public stun(duration: number): any {}
}

export enum PaladinStyle {
    None = 0,
    AuraThunder = 1,
    AuraSun = 2,
    ProtectiveAura = 3,
    RighteousFury = 4,
    Bonk = 5,
    BurnBurnBurn = 6,
}

export enum PaladinUltimate {
    None = 0,
    Radiance = 1,
    Judgement = 2,
    HolyPillar = 3,
}

export class PA_PaladinGear extends Component {
    public cooldownScale: number = 1.0;
    public static of(node: any): any { return null; }
    public setStage(stage: any, flag?: any): any {}
    public prepareAttack(...args: any[]): any {}
}

export class WA_ScreenFlash {
    public static flash(color?: any, alpha?: any, duration?: any) {}
}
