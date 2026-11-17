import { _decorator, Component, Node, Prefab, instantiate, Vec3, ParticleSystem, tween, Tween } from 'cc';
import { LCHConfig } from './LCHConfig';
import { LCHRoomBoundary } from './LCHRoomBoundary';
import { LCHEnemyStats } from './LCHEnemyStats';
import { LCHPropObstacle } from './LCHPropObstacle';

const { ccclass, property } = _decorator;

@ccclass('LCHEnemyMove')
export class LCHEnemyMove extends Component {
    @property({ type: LCHEnemyStats, tooltip: 'Component thông số LCHEnemyStats trên cùng quái' })
    public stats: LCHEnemyStats = null;

    @property({ type: Node, tooltip: 'Tham chiếu trực tiếp tới Node Character_Warrior' })
    public targetHeroNode: Node = null;

    @property({ type: LCHConfig, tooltip: 'Tham chiếu trực tiếp tới LCHConfig (System/Config)' })
    public config: LCHConfig = null;

    @property({ type: LCHRoomBoundary, tooltip: 'Giới hạn tường phòng LCHRoomBoundary' })
    public boundary: LCHRoomBoundary = null;

    @property({ type: Prefab, tooltip: 'Prefab khói bụi khi rơi chạm đất (FX_Smoke_Step.prefab)' })
    public dropSmokePrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa VFX (System/Pool)' })
    public vfxContainer: Node = null;

    public isMoving: boolean = false;
    public isAttackingAnim: boolean = false;
    public isHeroAliveCheck: (() => boolean) | null = null;
    public onPlayAnimCallback: ((animName: string, loop: boolean) => void) | null = null;

    private _initialWorldPos: Vec3 = new Vec3();
    private _hasSavedPos: boolean = false;
    private _myPos: Vec3 = new Vec3();
    private _heroPos: Vec3 = new Vec3();
    private _otherPos: Vec3 = new Vec3();
    private _moveDir: Vec3 = new Vec3();
    private _sepVec: Vec3 = new Vec3();
    private _smokePool: Node[] = [];

    protected onLoad(): void {
        this.saveInitialTransform();
        if (this.stats) {
            this.stats.onKnockbackCallback = (dx: number, dz: number) => this.applyExternalDisplacement(dx, dz);
        }
    }

    public saveInitialTransform(): void {
        if (!this._hasSavedPos) {
            this.node.getWorldPosition(this._initialWorldPos);
            this._hasSavedPos = true;
        }
    }

    public hideBeforeSpawn(): void {
        this.saveInitialTransform();
        if (this.stats) {
            this.stats.isAlive = false;
            this.stats.isCombatActive = false;
            this.stats.hideHpBar();
        }
        this.isMoving = false;
        this.node.active = false;
    }

    public dropFromCeiling(delay: number, roomIndex: number): void {
        this.saveInitialTransform();
        this.unscheduleAllCallbacks();
        Tween.stopAllByTarget(this.node);

        if (this.stats) {
            this.stats.applyRoomStats(roomIndex);
            this.stats.isAlive = true;
            this.stats.isCombatActive = false;
        }
        this.isMoving = false;
        this.isAttackingAnim = false;

        const cfg = this.config || LCHConfig.instance;
        const dropH = cfg ? cfg.dropHeight : 6.5;
        const dropDur = cfg ? cfg.dropDuration : 0.45;

        this.node.setScale(1, 1, 1);
        this.node.setRotationFromEuler(0, 0, 0);

        const startPos = new Vec3(this._initialWorldPos.x, dropH, this._initialWorldPos.z);
        const landPos = new Vec3(this._initialWorldPos.x, 0, this._initialWorldPos.z);

        this.scheduleOnce(() => {
            this.node.active = true;
            this.node.setWorldPosition(startPos);
            if (this.onPlayAnimCallback && this.stats) {
                this.onPlayAnimCallback(this.stats.isMage ? 'idle' : 'run', true);
            }

            tween(this.node)
                .to(dropDur, { worldPosition: landPos }, { easing: 'quadIn' })
                .call(() => {
                    this.node.setWorldPosition(landPos);
                    this.spawnDropSmoke(landPos, 1.0);
                    if (this.stats) {
                        this.stats.showHpBar();
                        this.stats.isCombatActive = true;
                    }
                })
                .start();
        }, Math.max(0, delay));
    }

    public respawnAtLastSpawn(spawnWorldPos: Vec3, delay: number): void {
        this.unscheduleAllCallbacks();
        Tween.stopAllByTarget(this.node);

        if (this.stats) {
            this.stats.applyRoomStats(3);
            this.stats.isAlive = true;
            this.stats.isCombatActive = false;
        }
        this.isMoving = false;
        this.isAttackingAnim = false;

        const s = this.stats ? this.stats.scaleMultiplier : 2.0;

        this.scheduleOnce(() => {
            this.node.active = true;
            this.node.setScale(s, s, s);
            this.node.setWorldPosition(spawnWorldPos.x, 0, spawnWorldPos.z);
            this.node.setRotationFromEuler(0, 0, 0);

            this.spawnDropSmoke(spawnWorldPos, 1.35);
            if (this.stats) {
                this.stats.showHpBar();
                this.stats.isCombatActive = true;
                if (this.onPlayAnimCallback) {
                    this.onPlayAnimCallback(this.stats.isMage ? 'idle' : 'run', true);
                }
            }
        }, Math.max(0, delay));
    }

    protected update(dt: number): void {
        if (!this.stats || !this.stats.isAlive || !this.stats.isCombatActive) return;

        const heroAlive = this.isHeroAliveCheck ? this.isHeroAliveCheck() : true;
        if (!this.targetHeroNode || !this.targetHeroNode.isValid || !heroAlive) {
            this.isMoving = false;
            if (!this.isAttackingAnim && this.onPlayAnimCallback) {
                this.onPlayAnimCallback('idle', true);
            }
            return;
        }

        this.node.getWorldPosition(this._myPos);
        this.targetHeroNode.getWorldPosition(this._heroPos);

        const toHeroX = this._heroPos.x - this._myPos.x;
        const toHeroZ = this._heroPos.z - this._myPos.z;
        const distToHero = Math.sqrt(toHeroX * toHeroX + toHeroZ * toHeroZ);

        if (distToHero > 0.05) {
            const targetYaw = Math.atan2(toHeroX, toHeroZ) * (180 / Math.PI);
            this.node.setRotationFromEuler(0, targetYaw, 0);
        }

        const cfg = this.config || LCHConfig.instance;
        const sepRadius = (cfg ? cfg.separationRadius : 0.95) * (this.stats.isInRoom3Rush ? 1.45 : 1.0);
        const sepForce = cfg ? cfg.separationForce : 2.2;
        this._sepVec.set(0, 0, 0);

        const list = LCHEnemyStats.activeList;
        for (let i = 0; i < list.length; i++) {
            const other = list[i];
            if (other === this.stats || !other.isAlive || !other.isCombatActive) continue;
            other.node.getWorldPosition(this._otherPos);
            const dx = this._myPos.x - this._otherPos.x;
            const dz = this._myPos.z - this._otherPos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq > 0.0001 && dSq < sepRadius * sepRadius) {
                const d = Math.sqrt(dSq);
                const push = (sepRadius - d) / sepRadius;
                this._sepVec.x += (dx / d) * push;
                this._sepVec.z += (dz / d) * push;
            }
        }

        // Mage dừng ở stopDist (~4.2m) bắn cầu lửa, không chủ động chạy lùi; Melee lao sát tới 0.85m
        if (distToHero > this.stats.stopDist && !this.isAttackingAnim) {
            const invDist = 1.0 / Math.max(0.001, distToHero);
            this._moveDir.set(
                toHeroX * invDist + this._sepVec.x * sepForce * 0.5,
                0,
                toHeroZ * invDist + this._sepVec.z * sepForce * 0.5
            );
            if (this._moveDir.lengthSqr() > 0.001) this._moveDir.normalize();

            this._myPos.x += this._moveDir.x * this.stats.moveSpeed * dt;
            this._myPos.z += this._moveDir.z * this.stats.moveSpeed * dt;
            this.clampPosition(this._myPos);
            this.node.setWorldPosition(this._myPos);

            this.isMoving = true;
            if (this.onPlayAnimCallback) {
                this.onPlayAnimCallback(this.stats.isMage ? 'idle' : 'run', true);
            }
        } else {
            if (this._sepVec.lengthSqr() > 0.01 && !this.isAttackingAnim) {
                this._myPos.x += this._sepVec.x * sepForce * 0.4 * dt;
                this._myPos.z += this._sepVec.z * sepForce * 0.4 * dt;
                this.clampPosition(this._myPos);
                this.node.setWorldPosition(this._myPos);
            }
            this.isMoving = false;
            if (!this.isAttackingAnim && this.onPlayAnimCallback) {
                this.onPlayAnimCallback(this.stats.isMage ? 'idle' : 'run', true);
            }
        }
    }

    public applyExternalDisplacement(dx: number, dz: number): void {
        if (!this.stats || !this.stats.isAlive || !this.stats.isCombatActive) return;
        this.node.getWorldPosition(this._myPos);
        this._myPos.x += dx;
        this._myPos.z += dz;
        this.clampPosition(this._myPos);
        this.node.setWorldPosition(this._myPos);
    }

    private clampPosition(pos: Vec3): void {
        if (this.stats && this.stats.isInRoom3Rush) {
            pos.x = pos.z < -45.5 ? Math.max(-1.8, Math.min(1.8, pos.x)) : Math.max(-4.35, Math.min(4.35, pos.x));
            pos.z = Math.max(-52.0, Math.min(-24.8, pos.z));
            pos.y = 0;
            LCHPropObstacle.resolveActorPosition(pos, 0.42);
        } else if (this.boundary) {
            this.boundary.clampPosition(pos);
        }
    }

    private spawnDropSmoke(pos: Vec3, scale: number): void {
        if (!this.dropSmokePrefab || !this.vfxContainer) return;
        let smoke = this._smokePool.pop();
        if (!smoke || !smoke.isValid) smoke = instantiate(this.dropSmokePrefab);
        smoke.setParent(this.vfxContainer);
        smoke.setWorldPosition(pos.x, 0.05, pos.z);
        smoke.setScale(scale, scale, scale);
        smoke.active = true;
        const ps = smoke.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < ps.length; i++) {
            ps[i].clear();
            ps[i].play();
        }
        this.scheduleOnce(() => {
            if (smoke && smoke.isValid) {
                smoke.active = false;
                this._smokePool.push(smoke);
            }
        }, 0.9);
    }
}
