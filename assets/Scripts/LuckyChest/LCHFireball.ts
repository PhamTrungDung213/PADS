import { _decorator, Component, Node, Prefab, instantiate, Vec3, Quat, ParticleSystem } from 'cc';

const { ccclass, property } = _decorator;

interface ActiveFireball {
    node: Node;
    pos: Vec3;
    dir: Vec3;
    speed: number;
    damage: number;
    scale: number;
    elapsed: number;
    maxLife: number;
}

@ccclass('LCHFireball')
export class LCHFireball extends Component {
    public static instance: LCHFireball = null;

    @property({ type: Prefab, tooltip: 'Prefab cầu lửa bay (FX_FireBall_bullet)' })
    public bulletPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Prefab nổ lửa khi trúng Warrior (FX_Fire_Explosion)' })
    public explosionPrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Node chứa các hiệu ứng đạn lửa (System/Pool)' })
    public vfxContainer: Node = null;

    @property({ type: Node, tooltip: 'Tham chiếu trực tiếp tới Node Character_Warrior' })
    public targetHeroNode: Node = null;

    public onHitHeroCallback: ((damage: number) => void) | null = null;
    public isHeroAliveCheck: (() => boolean) | null = null;

    private _activeBullets: ActiveFireball[] = [];
    private _bulletPool: Node[] = [];
    private _explosionPool: Node[] = [];
    private _tempHeroPos: Vec3 = new Vec3();

    protected onLoad(): void {
        LCHFireball.instance = this;
    }

    protected onDestroy(): void {
        if (LCHFireball.instance === this) {
            LCHFireball.instance = null;
        }
    }

    public spawnFireball(startPos: Vec3, targetPos: Vec3, speed: number, damage: number, scale: number = 1.0): void {
        if (!this.bulletPrefab || !this.vfxContainer) return;

        let bulletNode: Node = null;
        while (this._bulletPool.length > 0) {
            const candidate = this._bulletPool.pop();
            if (candidate && candidate.isValid) {
                bulletNode = candidate;
                break;
            }
        }
        if (!bulletNode) {
            bulletNode = instantiate(this.bulletPrefab);
        }

        bulletNode.setParent(this.vfxContainer);
        const spawnPos = new Vec3(startPos.x, startPos.y, startPos.z);
        bulletNode.setWorldPosition(spawnPos);
        bulletNode.setScale(scale, scale, scale);

        const dir = new Vec3(targetPos.x - startPos.x, 0, targetPos.z - startPos.z);
        if (dir.lengthSqr() > 0.0001) {
            dir.normalize();
        } else {
            dir.set(0, 0, 1);
        }

        const angleY = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
        const rot = new Quat();
        Quat.fromEuler(rot, 0, angleY, 0);
        bulletNode.setWorldRotation(rot);
        bulletNode.active = true;
        this.restartParticles(bulletNode);

        this._activeBullets.push({
            node: bulletNode,
            pos: spawnPos,
            dir,
            speed,
            damage,
            scale,
            elapsed: 0,
            maxLife: 2.8,
        });
    }

    public clearAllFireballs(): void {
        for (let i = this._activeBullets.length - 1; i >= 0; i--) {
            const b = this._activeBullets[i];
            if (b.node && b.node.isValid) {
                b.node.active = false;
                this._bulletPool.push(b.node);
            }
        }
        this._activeBullets.length = 0;
    }

    protected update(dt: number): void {
        if (this._activeBullets.length === 0) return;

        const heroAlive = this.isHeroAliveCheck ? this.isHeroAliveCheck() : true;
        const heroValid = this.targetHeroNode && this.targetHeroNode.isValid && heroAlive;
        if (heroValid) {
            this.targetHeroNode.getWorldPosition(this._tempHeroPos);
        }

        for (let i = this._activeBullets.length - 1; i >= 0; i--) {
            const b = this._activeBullets[i];
            if (!b.node || !b.node.isValid) {
                this._activeBullets.splice(i, 1);
                continue;
            }

            b.elapsed += dt;
            if (b.elapsed >= b.maxLife) {
                b.node.active = false;
                this._bulletPool.push(b.node);
                this._activeBullets.splice(i, 1);
                continue;
            }

            if (heroValid) {
                const toHeroX = this._tempHeroPos.x - b.pos.x;
                const toHeroZ = this._tempHeroPos.z - b.pos.z;
                const distSq = toHeroX * toHeroX + toHeroZ * toHeroZ;

                if (distSq <= 0.65 * 0.65) {
                    this.spawnExplosion(new Vec3(this._tempHeroPos.x, 0.85, this._tempHeroPos.z), b.scale * 0.55);
                    if (this.onHitHeroCallback) {
                        this.onHitHeroCallback(b.damage);
                    }
                    b.node.active = false;
                    this._bulletPool.push(b.node);
                    this._activeBullets.splice(i, 1);
                    continue;
                }

                const invLen = 1.0 / Math.max(0.001, Math.sqrt(distSq));
                const desiredX = toHeroX * invLen;
                const desiredZ = toHeroZ * invLen;
                const steer = Math.min(1.0, dt * 4.5);
                b.dir.x += (desiredX - b.dir.x) * steer;
                b.dir.z += (desiredZ - b.dir.z) * steer;
                const newLen = Math.sqrt(b.dir.x * b.dir.x + b.dir.z * b.dir.z);
                if (newLen > 0.001) {
                    b.dir.x /= newLen;
                    b.dir.z /= newLen;
                }
            }

            b.pos.x += b.dir.x * b.speed * dt;
            b.pos.z += b.dir.z * b.speed * dt;
            b.node.setWorldPosition(b.pos);
        }
    }

    private spawnExplosion(worldPos: Vec3, scale: number): void {
        if (!this.explosionPrefab || !this.vfxContainer) return;

        let expNode: Node = null;
        while (this._explosionPool.length > 0) {
            const candidate = this._explosionPool.pop();
            if (candidate && candidate.isValid) {
                expNode = candidate;
                break;
            }
        }
        if (!expNode) {
            expNode = instantiate(this.explosionPrefab);
        }

        expNode.setParent(this.vfxContainer);
        expNode.setWorldPosition(worldPos);
        expNode.setScale(scale, scale, scale);
        expNode.active = true;
        this.restartParticles(expNode);

        this.scheduleOnce(() => {
            if (expNode && expNode.isValid) {
                expNode.active = false;
                this._explosionPool.push(expNode);
            }
        }, 0.85);
    }

    private restartParticles(rootNode: Node): void {
        const particles = rootNode.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p && p.isValid) {
                p.clear();
                p.play();
            }
        }
    }
}
