import {
    _decorator,
    Component,
    Node,
    Prefab,
    Vec3,
    instantiate,
    ParticleSystem,
    MeshRenderer,
} from 'cc';
import { DefChestArrowKind, IDefChestEnemyTarget } from './DefChestTypes';
import { AudioManager } from '../System/AudioManager';
import { spawnOneShotVfx } from './DefChestSkillStrategies';

const { ccclass, property } = _decorator;

export { DefChestArrowKind };
export type { IDefChestEnemyTarget };

export interface DefChestProjectileLaunchParams {
    origin: Vec3;
    direction: Vec3;
    speed: number;
    maxDistance: number;
    damage: number;
    isCrit: boolean;
    arrowKind: DefChestArrowKind;
    ricochetBounces: number;
    ricochetRadius: number;
    pierceCount: number;
    fireAoeRadius: number;
    fireBurnDps: number;
    fireBurnDuration: number;
    lightningAoeRadius: number;
    lightningChainCount: number;
    getActiveEnemies: () => IDefChestEnemyTarget[];
    onRecycle: (projNode: Node) => void;
    fireTrailPrefab?: Prefab | null;
    fireImpactPrefab?: Prefab | null;
    burnLoopPrefab?: Prefab | null;
    lightningTrailPrefab?: Prefab | null;
    lightningImpactPrefab?: Prefab | null;
    lightningChainPrefab?: Prefab | null;
    hitImpactPrefab?: Prefab | null;
    vfxRoot?: Node | null;
}

const RAD_TO_DEG = 180 / Math.PI;
const _tmpPos = new Vec3();
const _tmpDir = new Vec3();

/** Đạn mũi tên 3D của Ranger: hỗ trợ bắn chùm, Ricochet, Pierce, Fire và Lightning. */
@ccclass('DefChestProjectile')
export class DefChestProjectile extends Component {
    @property({ tooltip: 'Bán kính va chạm của mũi tên (m)' })
    public hitRadius: number = 0.75;

    private _active: boolean = false;
    private _params: DefChestProjectileLaunchParams | null = null;
    private _dir: Vec3 = new Vec3(0, 0, 1);
    private _traveled: number = 0;
    private _remainingBounces: number = 0;
    private _remainingPierces: number = 0;
    private _hitTargets: Set<IDefChestEnemyTarget> = new Set();
    private _attachedTrailNode: Node | null = null;
    private _meshPrepared: boolean = false;

    public launch(params: DefChestProjectileLaunchParams): void {
        this._params = params;
        this._active = true;
        this._traveled = 0;
        this._remainingBounces = params.ricochetBounces;
        this._remainingPierces = params.pierceCount;
        this._hitTargets.clear();

        this.ensure3DArrowMesh();

        this._dir.set(params.direction.x, 0, params.direction.z);
        if (this._dir.lengthSqr() < 0.0001) this._dir.set(0, 0, 1);
        else this._dir.normalize();

        this.node.setWorldPosition(params.origin);
        this.orientAlongDirection(this._dir);
        this.attachElementalTrail(params);
    }

    // Chuyển mesh mũi tên từ ParticleSystem bị khóa góc ngang sang MeshRenderer 3D hướng thẳng +Z
    private ensure3DArrowMesh(): void {
        if (this._meshPrepared) return;
        this._meshPrepared = true;

        const rootPs = this.node.getComponent(ParticleSystem);
        if (rootPs) {
            rootPs.stop();
            rootPs.enabled = false;
        }

        const flareNode = this.node.getChildByName('flarespikes_thin');
        if (flareNode) {
            const flarePs = flareNode.getComponent(ParticleSystem);
            if (flarePs) {
                flarePs.stop();
                flarePs.enabled = false;
            }
            flareNode.active = false;
        }

        const bulletNode = this.node.getChildByName('bullet');
        if (!bulletNode) return;

        const bulletPs = bulletNode.getComponent(ParticleSystem);
        const arrowMesh = bulletPs?.renderer?.mesh;
        const arrowMat = bulletPs?.renderer?.cpuMaterial || bulletPs?.renderer?.particleMaterial;
        if (bulletPs) {
            bulletPs.stop();
            bulletPs.enabled = false;
        }
        if (!arrowMesh) return;

        let meshNode = this.node.getChildByName('ArrowMesh3D');
        if (!meshNode) {
            meshNode = new Node('ArrowMesh3D');
            meshNode.layer = this.node.layer;
            meshNode.setParent(this.node);
        }
        meshNode.setPosition(0, 0, 0);
        meshNode.setRotationFromEuler(90, 0, 0);
        meshNode.setScale(0.85, 0.85, 0.85);

        const mr = meshNode.getComponent(MeshRenderer) || meshNode.addComponent(MeshRenderer);
        mr.mesh = arrowMesh;
        if (arrowMat) mr.setSharedMaterial(arrowMat, 0);
    }

    private orientAlongDirection(dir: Vec3): void {
        if (dir.lengthSqr() < 0.0001) return;
        this.node.setRotationFromEuler(0, Math.atan2(dir.x, dir.z) * RAD_TO_DEG, 0);
    }

    private attachElementalTrail(params: DefChestProjectileLaunchParams): void {
        this.clearAttachedTrail();
        const trailPrefab = params.arrowKind === DefChestArrowKind.FIRE
            ? params.fireTrailPrefab
            : params.arrowKind === DefChestArrowKind.LIGHTNING
                ? params.lightningTrailPrefab
                : null;
        if (!trailPrefab) return;

        const trail = instantiate(trailPrefab);
        trail.setParent(this.node);
        trail.setPosition(0, 0, 0);
        trail.setScale(0.45, 0.45, 0.45);
        this._attachedTrailNode = trail;

        const psList = trail.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < psList.length; i++) {
            psList[i].stop();
            psList[i].clear();
            psList[i].play();
        }
    }

    private clearAttachedTrail(): void {
        if (this._attachedTrailNode && this._attachedTrailNode.isValid) {
            this._attachedTrailNode.destroy();
        }
        this._attachedTrailNode = null;
    }

    protected update(dt: number): void {
        if (!this._active || !this._params) return;

        const step = this._params.speed * dt;
        this.node.getWorldPosition(_tmpPos);
        _tmpPos.x += this._dir.x * step;
        _tmpPos.z += this._dir.z * step;
        this.node.setWorldPosition(_tmpPos);
        this._traveled += step;

        const enemies = this._params.getActiveEnemies();
        const hitR2 = this.hitRadius * this.hitRadius;

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy || enemy.isDead || !enemy.node || !enemy.node.isValid) continue;
            if (this._hitTargets.has(enemy)) continue;

            const ep = enemy.node.worldPosition;
            const dx = ep.x - _tmpPos.x;
            const dz = ep.z - _tmpPos.z;
            if (dx * dx + dz * dz <= hitR2) {
                this.onHitEnemy(enemy, _tmpPos, enemies);
                if (!this._active) return;
                break;
            }
        }

        if (this._traveled >= this._params.maxDistance) {
            this.recycleSelf();
        }
    }

    private onHitEnemy(primary: IDefChestEnemyTarget, impactPos: Vec3, allEnemies: IDefChestEnemyTarget[]): void {
        const params = this._params;
        if (!params) return;

        const vfxParent = params.vfxRoot || this.node.parent;
        this._hitTargets.add(primary);
        primary.takeDamage(params.damage, params.isCrit, this._dir, 0.18);
        AudioManager.instance?.playEnemyHit(false);

        if (params.hitImpactPrefab) {
            spawnOneShotVfx(params.hitImpactPrefab, vfxParent, impactPos, 0.75, 0.7, 0.4);
        }

        if (params.arrowKind === DefChestArrowKind.FIRE) {
            if (params.fireImpactPrefab) {
                spawnOneShotVfx(params.fireImpactPrefab, vfxParent, impactPos, 0.9, 1.0, 0.4);
            }
            const aoeR2 = params.fireAoeRadius * params.fireAoeRadius;
            for (let i = 0; i < allEnemies.length; i++) {
                const other = allEnemies[i];
                if (!other || other.isDead || !other.node.isValid) continue;
                const ep = other.node.worldPosition;
                if ((ep.x - impactPos.x) ** 2 + (ep.z - impactPos.z) ** 2 <= aoeR2) {
                    if (other !== primary) {
                        other.takeDamage(Math.round(params.damage * 0.55), false, this._dir, 0.1);
                    }
                    if (other.applyBurnDot && params.fireBurnDps > 0) {
                        other.applyBurnDot(params.fireBurnDps, params.fireBurnDuration, params.burnLoopPrefab);
                    }
                }
            }
        } else if (params.arrowKind === DefChestArrowKind.LIGHTNING) {
            if (params.lightningImpactPrefab) {
                spawnOneShotVfx(params.lightningImpactPrefab, vfxParent, impactPos, 0.85, 1.0, 0.4);
            }
            const aoeR2 = params.lightningAoeRadius * params.lightningAoeRadius;
            let chained = 0;
            for (let i = 0; i < allEnemies.length; i++) {
                const other = allEnemies[i];
                if (!other || other === primary || other.isDead || !other.node.isValid) continue;
                const ep = other.node.worldPosition;
                if ((ep.x - impactPos.x) ** 2 + (ep.z - impactPos.z) ** 2 <= aoeR2 && chained < params.lightningChainCount) {
                    chained++;
                    other.takeDamage(Math.round(params.damage * 0.7), params.isCrit, this._dir, 0.12);
                    if (params.lightningChainPrefab) {
                        spawnOneShotVfx(params.lightningChainPrefab, vfxParent, ep, 0.7, 0.85, 0.4);
                    }
                }
            }
        }

        if (this._remainingBounces > 0) {
            const nextTarget = this.findNearestUnhitEnemy(impactPos, params.ricochetRadius, allEnemies);
            if (nextTarget) {
                this._remainingBounces--;
                this._traveled = 0;
                const np = nextTarget.node.worldPosition;
                _tmpDir.set(np.x - impactPos.x, 0, np.z - impactPos.z);
                if (_tmpDir.lengthSqr() > 0.0001) {
                    _tmpDir.normalize();
                    this._dir.set(_tmpDir);
                    this.orientAlongDirection(this._dir);
                    return;
                }
            }
        }

        if (this._remainingPierces > 0) {
            this._remainingPierces--;
            return;
        }

        this.recycleSelf();
    }

    private findNearestUnhitEnemy(fromPos: Vec3, maxRadius: number, allEnemies: IDefChestEnemyTarget[]): IDefChestEnemyTarget | null {
        let best: IDefChestEnemyTarget | null = null;
        let bestD2 = maxRadius * maxRadius;
        for (let i = 0; i < allEnemies.length; i++) {
            const e = allEnemies[i];
            if (!e || e.isDead || !e.node.isValid || this._hitTargets.has(e)) continue;
            const ep = e.node.worldPosition;
            const d2 = (ep.x - fromPos.x) ** 2 + (ep.z - fromPos.z) ** 2;
            if (d2 < bestD2) {
                bestD2 = d2;
                best = e;
            }
        }
        return best;
    }

    private recycleSelf(): void {
        this._active = false;
        this.clearAttachedTrail();
        const cb = this._params?.onRecycle;
        this._params = null;
        this._hitTargets.clear();
        if (cb) cb(this.node);
        else this.node.active = false;
    }
}
