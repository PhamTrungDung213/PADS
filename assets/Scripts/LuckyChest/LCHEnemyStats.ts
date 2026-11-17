import { _decorator, Component, Node, Prefab, instantiate, Vec3, Camera, CCBoolean, tween, Tween } from 'cc';
import { LCHConfig } from './LCHConfig';
import { EnemyVFX } from '../VFX/EnemyVFX';
import { HPBar } from '../UI/HPBar';
import { DamageTextManager } from '../System/DamageTextManger';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('LCHEnemyStats')
export class LCHEnemyStats extends Component {
    public static activeList: LCHEnemyStats[] = [];

    @property({ type: CCBoolean, tooltip: 'Tick = Mage (phóng lửa từ xa), Bỏ tick = Melee (cận chiến)' })
    public isMage: boolean = false;

    @property({ type: LCHConfig, tooltip: 'Tham chiếu trực tiếp tới LCHConfig (System/Config)' })
    public config: LCHConfig = null;

    @property({ type: EnemyVFX, tooltip: 'Tham chiếu tới EnemyVFX trên quái' })
    public enemyVfx: EnemyVFX = null;

    @property({ type: Prefab, tooltip: 'Prefab thanh máu quái (HpBar.prefab)' })
    public hpBarPrefab: Prefab = null;

    @property({ type: Camera, tooltip: 'Main Camera 3D để xoay thanh máu Billboard' })
    public worldCamera: Camera = null;

    @property({ type: Node, tooltip: 'Container chứa thanh máu (System/Pool)' })
    public barContainer: Node = null;

    public isAlive: boolean = false;
    public isCombatActive: boolean = false;
    public isInRoom3Rush: boolean = false;
    public scaleMultiplier: number = 1.0;

    public maxHp: number = 36;
    public currentHp: number = 36;
    public damage: number = 5;
    public moveSpeed: number = 2.3;
    public attackRange: number = 1.15;
    public stopDist: number = 0.85;
    public attackCooldown: number = 0.95;
    public fireballSpeed: number = 7.0;

    public onDeathCallback: ((stats: LCHEnemyStats) => void) | null = null;
    public onKnockbackCallback: ((dx: number, dz: number) => void) | null = null;
    public onPlayAnimCallback: ((animName: string, loop: boolean) => void) | null = null;

    private _hpBarNode: Node = null;
    private _hpBarComp: HPBar = null;
    private _barPos: Vec3 = new Vec3();
    private _myPos: Vec3 = new Vec3();

    protected onEnable(): void {
        if (LCHEnemyStats.activeList.indexOf(this) === -1) {
            LCHEnemyStats.activeList.push(this);
        }
    }

    protected onDisable(): void {
        const idx = LCHEnemyStats.activeList.indexOf(this);
        if (idx !== -1) LCHEnemyStats.activeList.splice(idx, 1);
        if (this._hpBarNode && this._hpBarNode.isValid) {
            this._hpBarNode.active = false;
        }
    }

    protected onDestroy(): void {
        const idx = LCHEnemyStats.activeList.indexOf(this);
        if (idx !== -1) LCHEnemyStats.activeList.splice(idx, 1);
        if (this._hpBarNode && this._hpBarNode.isValid) {
            this._hpBarNode.destroy();
            this._hpBarNode = null;
        }
    }

    public applyRoomStats(roomIndex: number): void {
        const cfg = this.config || LCHConfig.instance;
        if (!cfg) return;

        if (roomIndex === 1) {
            this.scaleMultiplier = 1.0;
            this.isInRoom3Rush = false;
            this.maxHp = this.isMage ? cfg.p1MageHp : cfg.p1MeleeHp;
            this.damage = this.isMage ? cfg.p1MageDamage : cfg.p1MeleeDamage;
            this.moveSpeed = this.isMage ? cfg.p1MageMoveSpeed : cfg.p1MeleeMoveSpeed;
            this.attackRange = this.isMage ? cfg.p1MageAttackRange : cfg.p1MeleeAttackRange;
            this.stopDist = this.isMage ? cfg.p1MageStopDist : cfg.p1MeleeStopDist;
            this.attackCooldown = this.isMage ? cfg.p1MageAttackCooldown : cfg.p1MeleeAttackCooldown;
            this.fireballSpeed = cfg.p1FireballSpeed;
        } else if (roomIndex === 2) {
            this.scaleMultiplier = 1.0;
            this.isInRoom3Rush = false;
            this.maxHp = this.isMage ? cfg.p2MageHp : cfg.p2MeleeHp;
            this.damage = this.isMage ? cfg.p2MageDamage : cfg.p2MeleeDamage;
            this.moveSpeed = this.isMage ? cfg.p2MageMoveSpeed : cfg.p2MeleeMoveSpeed;
            this.attackRange = this.isMage ? cfg.p2MageAttackRange : cfg.p2MeleeAttackRange;
            this.stopDist = this.isMage ? cfg.p2MageStopDist : cfg.p2MeleeStopDist;
            this.attackCooldown = this.isMage ? cfg.p2MageAttackCooldown : cfg.p2MeleeAttackCooldown;
            this.fireballSpeed = cfg.p2FireballSpeed;
        } else {
            this.scaleMultiplier = cfg.p3ScaleMultiplier;
            this.isInRoom3Rush = true;
            this.maxHp = (this.isMage ? cfg.p3BaseMageHp : cfg.p3BaseMeleeHp) * cfg.p3HpMultiplier;
            this.damage = (this.isMage ? cfg.p3BaseMageDamage : cfg.p3BaseMeleeDamage) * cfg.p3DamageMultiplier;
            this.moveSpeed = (this.isMage ? cfg.p2MageMoveSpeed : cfg.p2MeleeMoveSpeed) * cfg.p3MoveSpeedMultiplier;
            this.attackRange = (this.isMage ? cfg.p2MageAttackRange : cfg.p2MeleeAttackRange) * (this.isMage ? 1.15 : 1.35);
            this.stopDist = (this.isMage ? cfg.p2MageStopDist : cfg.p2MeleeStopDist) * (this.isMage ? 1.1 : 1.3);
            this.attackCooldown = (this.isMage ? cfg.p2MageAttackCooldown : cfg.p2MeleeAttackCooldown) * 0.85;
            this.fireballSpeed = cfg.p2FireballSpeed * 1.15;
        }
        this.currentHp = this.maxHp;
    }

    public showHpBar(): void {
        if (!this._hpBarNode || !this._hpBarNode.isValid) {
            if (!this.hpBarPrefab || !this.barContainer) return;
            this._hpBarNode = instantiate(this.hpBarPrefab);
            this._hpBarNode.setParent(this.barContainer);
            this._hpBarComp = this._hpBarNode.getComponent(HPBar);
        }
        this._hpBarNode.setScale(0.01, 0.01, 0.01);
        this._hpBarNode.active = true;
        if (this._hpBarComp) {
            this._hpBarComp.setProgress(this.currentHp / Math.max(1, this.maxHp));
        }
    }

    public hideHpBar(): void {
        if (this._hpBarNode && this._hpBarNode.isValid) {
            this._hpBarNode.active = false;
        }
    }

    public takeDamage(amount: number, isCrit: boolean, attackerNode?: Node): void {
        if (!this.isAlive || amount <= 0) return;
        this.currentHp = Math.max(0, this.currentHp - amount);
        if (this._hpBarComp) {
            this._hpBarComp.setProgress(this.currentHp / Math.max(1, this.maxHp));
        }
        if (DamageTextManager.instance) {
            DamageTextManager.instance.showDamage(this.node, amount, isCrit, attackerNode);
        }
        if (this.enemyVfx) this.enemyVfx.playHit(attackerNode);
        if (AudioManager.instance) AudioManager.instance.playEnemyHit();

        if (attackerNode && attackerNode.isValid && !this.isInRoom3Rush && this.onKnockbackCallback) {
            const aPos = attackerNode.worldPosition;
            this.node.getWorldPosition(this._myPos);
            const kx = this._myPos.x - aPos.x;
            const kz = this._myPos.z - aPos.z;
            const len = Math.sqrt(kx * kx + kz * kz);
            if (len > 0.01) {
                this.onKnockbackCallback((kx / len) * 0.22, (kz / len) * 0.22);
            }
        }
        if (this.currentHp <= 0) this.die();
    }

    private die(): void {
        if (!this.isAlive) return;
        this.isAlive = false;
        this.isCombatActive = false;
        this.hideHpBar();
        if (this.enemyVfx) this.enemyVfx.playDeath();
        if (AudioManager.instance) AudioManager.instance.playEnemyDie();
        if (this.onDeathCallback) this.onDeathCallback(this);

        if (!this.isMage && this.onPlayAnimCallback) {
            this.onPlayAnimCallback('die', false);
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid && !this.isAlive) this.node.active = false;
            }, 0.75);
        } else {
            Tween.stopAllByTarget(this.node);
            tween(this.node)
                .to(0.32, { scale: new Vec3(0.05, 0.05, 0.05) }, { easing: 'backIn' })
                .call(() => {
                    if (this.node && this.node.isValid && !this.isAlive) this.node.active = false;
                })
                .start();
        }
    }

    protected lateUpdate(): void {
        if (this.isAlive && this.isCombatActive && this._hpBarNode && this._hpBarNode.isValid && this._hpBarNode.active) {
            this.node.getWorldPosition(this._barPos);
            this._barPos.y += 1.9 * this.scaleMultiplier;
            this._hpBarNode.setWorldPosition(this._barPos);
            if (this.worldCamera && this.worldCamera.node) {
                this._hpBarNode.setWorldRotation(this.worldCamera.node.worldRotation);
            }
        }
    }
}
