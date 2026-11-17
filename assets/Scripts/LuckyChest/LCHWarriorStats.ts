import { _decorator, Component, Node, Camera, Vec3 } from 'cc';
import { LCHConfig } from './LCHConfig';
import { LCHWarriorAnim } from './LCHWarriorAnim';
import { ExpBar } from '../UI/ExpBar';

const { ccclass, property } = _decorator;

@ccclass('LCHWarriorStats')
export class LCHWarriorStats extends Component {
    @property({ type: LCHConfig, tooltip: 'Tham chiếu trực tiếp tới LCHConfig (System/Config)' })
    public config: LCHConfig = null;

    @property({ type: LCHWarriorAnim, tooltip: 'Component LCHWarriorAnim trên cùng nhân vật' })
    public anim: LCHWarriorAnim = null;

    @property({ type: Node, tooltip: 'Vũ khí Phòng 1: SM_dagger Socket/dagger' })
    public daggerNode: Node = null;

    @property({ type: Node, tooltip: 'Vũ khí Phòng 2: SM_dagger Socket/axe_Tier2' })
    public axe1Node: Node = null;

    @property({ type: Node, tooltip: 'Vũ khí Phòng 3: SM_dagger Socket/two_handed_axe_Tier2' })
    public axe2Node: Node = null;

    @property({ type: Node, tooltip: 'Node thanh máu Hero_ExpBar trên đầu Warrior' })
    public healthBarNode: Node = null;

    @property({ type: ExpBar, tooltip: 'Component ExpBar (useAsHealthBar = true) trên Hero_ExpBar' })
    public healthBarComp: ExpBar = null;

    @property({ type: Camera, tooltip: 'Main Camera 3D để xoay thanh máu Billboard' })
    public worldCamera: Camera = null;

    public isAlive: boolean = true;
    public canDieInCurrentRoom: boolean = false;
    public weaponStage: number = 1;

    public maxHp: number = 500;
    public currentHp: number = 500;
    public damage: number = 18;
    public attackRange: number = 1.8;
    public attackCooldown: number = 0.48;
    public cleaveArc: number = 110;
    public maxTargets: number = 2;

    public onHeroDiedCallback: (() => void) | null = null;
    public onLockControlCallback: ((locked: boolean) => void) | null = null;

    private _barPos: Vec3 = new Vec3();

    public setWeaponStage(stage: number, playUpgradeFx: boolean = false): void {
        this.weaponStage = stage;
        const cfg = this.config || LCHConfig.instance;

        if (this.daggerNode) this.daggerNode.active = (stage === 1);
        if (this.axe1Node) this.axe1Node.active = (stage === 2);
        if (this.axe2Node) this.axe2Node.active = (stage === 3);

        if (cfg) {
            if (stage === 1) {
                this.maxHp = cfg.p1HeroMaxHp;
                this.currentHp = this.maxHp;
                this.damage = cfg.p1HeroDamage;
                this.attackRange = cfg.p1HeroAttackRange;
                this.attackCooldown = cfg.p1HeroAttackCooldown;
                this.cleaveArc = cfg.p1HeroCleaveArc;
                this.maxTargets = cfg.p1HeroMaxTargets;
            } else if (stage === 2) {
                this.maxHp = cfg.p2HeroMaxHp;
                if (cfg.p2HealToFull) this.currentHp = this.maxHp;
                this.damage = cfg.p2HeroDamage;
                this.attackRange = cfg.p2HeroAttackRange;
                this.attackCooldown = cfg.p2HeroAttackCooldown;
                this.cleaveArc = cfg.p2HeroCleaveArc;
                this.maxTargets = cfg.p2HeroMaxTargets;
            } else {
                this.maxHp = cfg.p3HeroMaxHp;
                if (cfg.p3HealToFull) this.currentHp = this.maxHp;
                this.damage = cfg.p3HeroDamage;
                this.attackRange = cfg.p3HeroAttackRange;
                this.attackCooldown = cfg.p3HeroAttackCooldown;
                this.cleaveArc = cfg.p3HeroCleaveArc;
                this.maxTargets = cfg.p3HeroMaxTargets;
            }
        }

        if (this.healthBarNode) {
            this.healthBarNode.active = true;
            this.healthBarNode.setScale(0.01, 0.01, 0.01);
        }
        this.updateHealthBarUI();

        if (playUpgradeFx && this.anim) {
            this.anim.playWeaponUpgradeFx(stage);
        }
    }

    public takeDamage(amount: number): void {
        if (!this.isAlive || amount <= 0) return;

        if (this.canDieInCurrentRoom) {
            this.currentHp = Math.max(0, this.currentHp - amount);
        } else {
            this.currentHp = Math.max(this.maxHp * 0.2, this.currentHp - amount);
        }

        this.updateHealthBarUI();
        if (this.anim) {
            this.anim.playBloodHitFx();
        }

        if (this.currentHp <= 0 && this.canDieInCurrentRoom) {
            this.die();
        }
    }

    private die(): void {
        if (!this.isAlive) return;
        this.isAlive = false;
        if (this.onLockControlCallback) {
            this.onLockControlCallback(true);
        }
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.active = false;
        }
        if (this.anim) {
            this.anim.playDeathFx();
        }
        this.scheduleOnce(() => {
            if (this.onHeroDiedCallback) {
                this.onHeroDiedCallback();
            }
        }, 1.35);
    }

    public updateHealthBarUI(): void {
        if (this.healthBarComp) {
            this.healthBarComp.setProgress(this.currentHp / Math.max(1, this.maxHp));
        }
    }

    protected lateUpdate(): void {
        if (this.isAlive && this.healthBarNode && this.healthBarNode.isValid && this.healthBarNode.active) {
            this.node.getWorldPosition(this._barPos);
            this._barPos.y += 2.35;
            this.healthBarNode.setWorldPosition(this._barPos);
            if (this.worldCamera && this.worldCamera.node) {
                this.healthBarNode.setWorldRotation(this.worldCamera.node.worldRotation);
            }
        }
    }
}
