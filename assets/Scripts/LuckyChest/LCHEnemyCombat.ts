import { _decorator, Component, Node, Prefab, instantiate, Vec3, SkeletalAnimation, ParticleSystem } from 'cc';
import { LCHEnemyStats } from './LCHEnemyStats';
import { LCHEnemyMove } from './LCHEnemyMove';
import { LCHFireball } from './LCHFireball';

const { ccclass, property } = _decorator;

@ccclass('LCHEnemyCombat')
export class LCHEnemyCombat extends Component {
    @property({ type: LCHEnemyStats, tooltip: 'Component thông số LCHEnemyStats trên cùng quái' })
    public stats: LCHEnemyStats = null;

    @property({ type: LCHEnemyMove, tooltip: 'Component di chuyển LCHEnemyMove trên cùng quái' })
    public move: LCHEnemyMove = null;

    @property({ type: SkeletalAnimation, tooltip: 'Component SkeletalAnimation trên quái' })
    public skeletalAnim: SkeletalAnimation = null;

    @property({ type: Node, tooltip: 'Xương gốc Root_M để khóa Root Motion' })
    public rootBone: Node = null;

    @property({ type: Prefab, tooltip: 'Prefab tụ lửa trên tay Mage (FX_Fireball_charge.prefab)' })
    public fireChargePrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa VFX (System/Pool)' })
    public vfxContainer: Node = null;

    @property({ type: LCHFireball, tooltip: 'Quản lý đạn cầu lửa (LCHFireball trên System/Pool)' })
    public fireballManager: LCHFireball = null;

    public onDealDamageToHero: ((damage: number) => void) | null = null;

    private _attackTimer: number = 0.25;
    private _currentAnimName: string = '';
    private _chargeVfxNode: Node = null;
    private _myPos: Vec3 = new Vec3();
    private _heroPos: Vec3 = new Vec3();

    protected onLoad(): void {
        const playCb = (anim: string, loop: boolean) => this.playAnim(anim, loop);
        if (this.stats) this.stats.onPlayAnimCallback = playCb;
        if (this.move) this.move.onPlayAnimCallback = playCb;
    }

    protected onDisable(): void {
        if (this._chargeVfxNode && this._chargeVfxNode.isValid) {
            this._chargeVfxNode.active = false;
        }
    }

    protected onDestroy(): void {
        if (this._chargeVfxNode && this._chargeVfxNode.isValid) {
            this._chargeVfxNode.destroy();
            this._chargeVfxNode = null;
        }
    }

    protected update(dt: number): void {
        if (!this.stats || !this.stats.isAlive || !this.stats.isCombatActive) return;
        if (!this.move || !this.move.targetHeroNode || !this.move.targetHeroNode.isValid) return;

        const heroAlive = this.move.isHeroAliveCheck ? this.move.isHeroAliveCheck() : true;
        if (!heroAlive) return;

        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        this.node.getWorldPosition(this._myPos);
        this.move.targetHeroNode.getWorldPosition(this._heroPos);

        const dx = this._heroPos.x - this._myPos.x;
        const dz = this._heroPos.z - this._myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= this.stats.attackRange && this._attackTimer <= 0) {
            this.performAttack();
        }
    }

    private performAttack(): void {
        this._attackTimer = this.stats.attackCooldown;
        if (this.move) this.move.isAttackingAnim = true;
        this.playAnim('attack', false);

        if (this.stats.isMage) {
            this.showMageChargeVfx();
            this.scheduleOnce(() => {
                if (!this.stats || !this.stats.isAlive || !this.move || !this.move.targetHeroNode) return;
                const heroAlive = this.move.isHeroAliveCheck ? this.move.isHeroAliveCheck() : true;
                if (!heroAlive) return;

                this.node.getWorldPosition(this._myPos);
                this.move.targetHeroNode.getWorldPosition(this._heroPos);

                const fwd = this.node.forward;
                const s = this.stats.scaleMultiplier;
                const castPos = new Vec3(
                    this._myPos.x - fwd.x * 0.45 * s,
                    1.05 * s,
                    this._myPos.z - fwd.z * 0.45 * s
                );
                const fbMgr = this.fireballManager || LCHFireball.instance;
                if (fbMgr) {
                    fbMgr.spawnFireball(castPos, this._heroPos, this.stats.fireballSpeed, this.stats.damage, s);
                }
            }, 0.35);

            this.scheduleOnce(() => {
                if (this.move) this.move.isAttackingAnim = false;
            }, 0.75);
        } else {
            if (this.stats.enemyVfx && this.move) {
                this.stats.enemyVfx.playAttack(this.move.targetHeroNode);
            }
            this.scheduleOnce(() => {
                if (!this.stats || !this.stats.isAlive || !this.move || !this.move.targetHeroNode) return;
                const heroAlive = this.move.isHeroAliveCheck ? this.move.isHeroAliveCheck() : true;
                if (!heroAlive) return;

                this.node.getWorldPosition(this._myPos);
                this.move.targetHeroNode.getWorldPosition(this._heroPos);
                const dx = this._heroPos.x - this._myPos.x;
                const dz = this._heroPos.z - this._myPos.z;
                if (dx * dx + dz * dz <= (this.stats.attackRange + 0.55) * (this.stats.attackRange + 0.55)) {
                    if (this.onDealDamageToHero) {
                        this.onDealDamageToHero(this.stats.damage);
                    }
                }
            }, 0.28);

            this.scheduleOnce(() => {
                if (this.move) this.move.isAttackingAnim = false;
            }, 0.65);
        }
    }

    private showMageChargeVfx(): void {
        if (!this.fireChargePrefab || !this.vfxContainer || !this.stats) return;
        if (!this._chargeVfxNode || !this._chargeVfxNode.isValid) {
            this._chargeVfxNode = instantiate(this.fireChargePrefab);
            this._chargeVfxNode.setParent(this.vfxContainer);
        }
        this.node.getWorldPosition(this._myPos);
        const s = 0.8 * this.stats.scaleMultiplier;
        this._chargeVfxNode.setWorldPosition(this._myPos.x, 1.15 * this.stats.scaleMultiplier, this._myPos.z);
        this._chargeVfxNode.setScale(s, s, s);
        this._chargeVfxNode.active = true;
        const ps = this._chargeVfxNode.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < ps.length; i++) {
            ps[i].clear();
            ps[i].play();
        }
        this.scheduleOnce(() => {
            if (this._chargeVfxNode && this._chargeVfxNode.isValid) {
                this._chargeVfxNode.active = false;
            }
        }, 0.45);
    }

    public playAnim(animName: string, loop: boolean): void {
        if (!this.skeletalAnim) return;
        if (this._currentAnimName === animName && loop) return;
        this._currentAnimName = animName;
        this.skeletalAnim.crossFade(animName, 0.12);
    }

    protected lateUpdate(): void {
        if (this.rootBone && this.rootBone.isValid) {
            const p = this.rootBone.position;
            if (Math.abs(p.x) > 0.001 || Math.abs(p.z) > 0.001) {
                this.rootBone.setPosition(0, p.y, 0);
            }
        }
    }
}
