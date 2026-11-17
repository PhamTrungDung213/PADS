import { _decorator, Component, Node, Prefab, instantiate, Vec3, Color } from 'cc';
import { AudioManager } from '../System/AudioManager';
import { PaladinGroundFx } from '../VFX/PaladinGroundFx';
import { LCHConfig } from './LCHConfig';
import { LCHWarriorStats } from './LCHWarriorStats';
import { LCHWarriorAnim } from './LCHWarriorAnim';
import { LCHWarriorMove } from './LCHWarriorMove';
import { LCHEnemyStats } from './LCHEnemyStats';
import { LCHPropObstacle } from './LCHPropObstacle';

const { ccclass, property } = _decorator;

@ccclass('LCHWarriorCombat')
export class LCHWarriorCombat extends Component {
    @property({ type: LCHWarriorStats, tooltip: 'Component thông số LCHWarriorStats trên cùng nhân vật' })
    public stats: LCHWarriorStats = null;

    @property({ type: LCHWarriorAnim, tooltip: 'Component hoạt ảnh LCHWarriorAnim trên cùng nhân vật' })
    public anim: LCHWarriorAnim = null;

    @property({ type: LCHWarriorMove, tooltip: 'Component di chuyển LCHWarriorMove trên cùng nhân vật' })
    public move: LCHWarriorMove = null;

    @property({ type: LCHConfig, tooltip: 'File cấu hình LCHConfig (System/Config)' })
    public config: LCHConfig = null;

    @property({ type: Node, tooltip: 'Container chứa các hiệu ứng VFX (System/Pool)' })
    public vfxContainer: Node = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng tia lửa trúng quái (FX_FireBolt_impact.prefab)' })
    public hitSparkPrefab: Prefab = null;

    private _attackTimer: number = 0;
    private _isAttackAnimPlaying: boolean = false;
    private _hitSparkPool: Node[] = [];
    private _myPos: Vec3 = new Vec3();
    private _enemyPos: Vec3 = new Vec3();

    protected update(dt: number): void {
        if (!this.stats || !this.stats.isAlive) return;
        if (!this.move || this.move.isIntroWalking) return;

        if (this._attackTimer > 0) {
            this._attackTimer -= dt;
        }

        if (this.move.isMovingInput) {
            this._isAttackAnimPlaying = false;
            this.move.isPerformingAttack = false;
            return;
        }

        const nearestEnemy = this.findNearestEnemyInRange(this.stats.attackRange);
        if (nearestEnemy) {
            this.node.getWorldPosition(this._myPos);
            nearestEnemy.node.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - this._myPos.x;
            const dz = this._enemyPos.z - this._myPos.z;
            if (dx * dx + dz * dz > 0.001) {
                this.move.facingDir.set(dx, 0, dz).normalize();
                const targetYaw = Math.atan2(this.move.facingDir.x, this.move.facingDir.z) * (180 / Math.PI);
                this.node.setRotationFromEuler(0, targetYaw, 0);
            }

            if (this._attackTimer <= 0) {
                this.performAttack(nearestEnemy);
            } else if (!this._isAttackAnimPlaying && this.anim) {
                this.anim.playAnim('idle', true);
            }
        } else {
            if (!this._isAttackAnimPlaying && this.anim) {
                this.anim.playAnim('idle', true);
            }
        }
    }

    private findNearestEnemyInRange(range: number): LCHEnemyStats | null {
        const list = LCHEnemyStats.activeList;
        let best: LCHEnemyStats = null;
        let bestDistSq = range * range;

        this.node.getWorldPosition(this._myPos);
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e || !e.isAlive) continue;
            e.node.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - this._myPos.x;
            const dz = this._enemyPos.z - this._myPos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq <= bestDistSq) {
                bestDistSq = dSq;
                best = e;
            }
        }
        return best;
    }

    private performAttack(primaryTarget: LCHEnemyStats): void {
        this._attackTimer = this.stats.attackCooldown;
        this._isAttackAnimPlaying = true;
        if (this.move) this.move.isPerformingAttack = true;
        if (this.anim) {
            this.anim.playAnim('attack', false, 0.08);
        }
        if (AudioManager.instance) {
            AudioManager.instance.playAttack();
        }

        // Chỉ phát hiệu ứng vệt vung của Axe (PaladinGroundFx.swoosh), đã bỏ hiệu ứng FX_Dagger1_Attack
        this.spawnAxeSlashVfx();

        this.scheduleOnce(() => {
            if (!this.stats || !this.stats.isAlive) return;
            this.applyCleaveDamage(primaryTarget);
        }, 0.18);

        this.scheduleOnce(() => {
            this._isAttackAnimPlaying = false;
            if (this.move) this.move.isPerformingAttack = false;
        }, Math.min(0.38, this.stats.attackCooldown * 0.85));
    }

    private spawnAxeSlashVfx(): void {
        this.node.getWorldPosition(this._myPos);
        const facing = this.move ? this.move.facingDir : new Vec3(0, 0, -1);
        const angleRad = Math.atan2(facing.x, facing.z);
        const stage = this.stats ? this.stats.weaponStage : 1;

        let swooshColor = new Color(210, 240, 255, 255);
        let swooshRadius = 1.65;

        if (stage === 2) {
            swooshColor = new Color(210, 130, 255, 255);
            swooshRadius = 2.25;
        } else if (stage === 3) {
            swooshColor = new Color(255, 200, 65, 255);
            swooshRadius = 2.75;
        }

        PaladinGroundFx.swoosh(this._myPos, {
            radius: swooshRadius,
            angle: angleRad,
            travel: stage === 3 ? 135 : 95,
            duration: 0.22,
            color: swooshColor,
            lift: 0.85,
            full: stage === 3,
        });
    }

    private applyCleaveDamage(primaryTarget: LCHEnemyStats): void {
        this.node.getWorldPosition(this._myPos);
        const cfg = this.config || LCHConfig.instance;
        const critRate = cfg ? cfg.critRate : 0.25;
        const critMult = cfg ? cfg.critMultiplier : 2.0;
        const facing = this.move ? this.move.facingDir : new Vec3(0, 0, -1);

        const halfArcCos = Math.cos((this.stats.cleaveArc * 0.5 * Math.PI) / 180);
        const rangeSq = (this.stats.attackRange + 0.35) * (this.stats.attackRange + 0.35);

        // Nếu đòn vung vũ khí đánh quái có quét trúng Vase trong tầm vung -> Phá vỡ Vase
        LCHPropObstacle.breakVasesInSwingArc(this._myPos, facing, this.stats.attackRange + 0.35, halfArcCos);

        const candidates: { enemy: LCHEnemyStats; distSq: number }[] = [];
        const list = LCHEnemyStats.activeList;

        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e || !e.isAlive) continue;
            e.node.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - this._myPos.x;
            const dz = this._enemyPos.z - this._myPos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq > rangeSq) continue;

            if (e === primaryTarget || dSq < 0.85 * 0.85) {
                candidates.push({ enemy: e, distSq: dSq });
                continue;
            }

            const invD = 1.0 / Math.max(0.001, Math.sqrt(dSq));
            const dot = (dx * invD) * facing.x + (dz * invD) * facing.z;
            if (dot >= halfArcCos) {
                candidates.push({ enemy: e, distSq: dSq });
            }
        }

        candidates.sort((a, b) => a.distSq - b.distSq);
        const hitCount = Math.min(this.stats.maxTargets, candidates.length);
        let anyCrit = false;

        for (let i = 0; i < hitCount; i++) {
            const target = candidates[i].enemy;
            const isCrit = Math.random() < critRate;
            if (isCrit) anyCrit = true;
            const finalDmg = isCrit ? this.stats.damage * critMult : this.stats.damage;

            target.node.getWorldPosition(this._enemyPos);
            this.spawnHitSpark(this._enemyPos);
            target.takeDamage(finalDmg, isCrit, this.node);
        }

        if (anyCrit && AudioManager.instance) {
            AudioManager.instance.playCrit();
        }
    }

    private spawnHitSpark(pos: Vec3): void {
        if (!this.hitSparkPrefab || !this.vfxContainer) return;
        let spark = this._hitSparkPool.pop();
        if (!spark || !spark.isValid) spark = instantiate(this.hitSparkPrefab);
        spark.setParent(this.vfxContainer);
        spark.setWorldPosition(pos.x, pos.y + 0.8, pos.z);
        spark.setScale(0.85, 0.85, 0.85);
        spark.active = true;
        if (this.anim) this.anim.restartParticles(spark);

        this.scheduleOnce(() => {
            if (spark && spark.isValid) {
                spark.active = false;
                this._hitSparkPool.push(spark);
            }
        }, 0.55);
    }
}
