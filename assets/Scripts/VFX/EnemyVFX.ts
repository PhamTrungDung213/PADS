import { _decorator, Component, Node, Prefab, instantiate, Vec3, Quat, CCFloat, ParticleSystem, assetManager, AudioClip } from 'cc';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('EnemyVFX')
export class EnemyVFX extends Component {
    @property({ type: Prefab, tooltip: 'Prefab hiệu ứng dấu chân khi quái bước đi (FX_Smoke_Step)' })
    public footstepPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Prefab hiệu ứng đòn đánh khi quái vung tay tấn công' })
    public attackPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Prefab hiệu ứng khi quái bị trúng đòn (FX_common_impact_bone)' })
    public hitPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Prefab hiệu ứng khi quái chết (FX_Smoke_Die)' })
    public deathPrefab: Prefab = null;

    @property({ type: AudioClip, tooltip: 'Âm thanh khi quái chết (AudioClip) - Tùy chọn gán riêng cho quái (nếu để trống sẽ dùng enemyDieClip trong AudioManager)' })
    public deathClip: AudioClip = null;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ scale khói bước chân' })
    public footstepScale: number = 0.5;

    @property({ type: CCFloat, tooltip: 'Khoảng cách thời gian giữa các bước chân (giây)' })
    public stepInterval: number = 0.32;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ scale hiệu ứng đòn đánh' })
    public attackVfxScale: number = 0.9;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ scale hiệu ứng bị đánh' })
    public hitVfxScale: number = 0.85;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ scale hiệu ứng khi chết' })
    public deathVfxScale: number = 1.0;

    // Static Pool dùng chung cho toàn bộ quái (tiết kiệm bộ nhớ, chống giật lag GC khi đông quái)
    private static _footstepPool: Node[] = [];
    private static _attackPool: Node[] = [];
    private static _hitPool: Node[] = [];
    private static _deathPool: Node[] = [];

    private _movement: any = null;
    private _stats: any = null;
    private _stepTimer: number = 0;
    private _isLeftFoot: boolean = false;

    onLoad() {
        this._movement = this.getComponent('EnemyMovement');
        this._stats = this.getComponent('Enemy');

        // Nạp prefab mặc định dự phòng nếu chưa kéo thả qua Inspector
        this.preloadDefaultPrefabs();
    }

    private preloadDefaultPrefabs() {
        if (!this.footstepPrefab) {
            assetManager.loadAny('705f710f-a771-4f1b-8420-2d8c13018e12', (err, asset: Prefab) => {
                if (!err && asset) this.footstepPrefab = asset;
            });
        }
        if (!this.hitPrefab) {
            assetManager.loadAny('644acb0e-a4b6-499e-b8a8-2cbce34f4380', (err, asset: Prefab) => {
                if (!err && asset) this.hitPrefab = asset;
            });
        }
        if (!this.deathPrefab) {
            assetManager.loadAny('b5795420-e3c2-48f9-91dc-b7eb18264a9b', (err, asset: Prefab) => {
                if (!err && asset) this.deathPrefab = asset;
            });
        }
        if (!this.attackPrefab) {
            assetManager.loadAny('fcc8cada-fa03-4691-8533-ea9c8c6534e5', (err, asset: Prefab) => {
                if (!err && asset) this.attackPrefab = asset;
            });
        }
    }

    update(dt: number) {
        this.updateFootstep(dt);
    }

    // =========================================================================
    // 1. DẤU CHÂN QUÁI (FOOTSTEP VFX) - ĐỘC LẬP TRÊN MẶT ĐẤT
    // =========================================================================
    private updateFootstep(dt: number) {
        if (!this.footstepPrefab) return;

        // Quái chỉ sinh khói khi đang sống và đang di chuyển
        const isMoving = this._movement ? this._movement.isMoving : false;
        const isAlive = this._stats ? this._stats.isAlive : true;

        if (isMoving && isAlive) {
            this._stepTimer += dt;
            if (this._stepTimer >= this.stepInterval) {
                this._stepTimer = 0;
                this.playFootstep();
            }
        } else {
            this._stepTimer = 0;
        }
    }

    public playFootstep() {
        if (!this.footstepPrefab) return;

        const myPos = this.node.worldPosition;
        const forward = this.node.forward;

        // So le chân trái / phải theo vector vuông góc với hướng nhìn
        this._isLeftFoot = !this._isLeftFoot;
        const sideOffset = this._isLeftFoot ? -0.18 : 0.18;
        const rightX = -forward.z * sideOffset;
        const rightZ = forward.x * sideOffset;
        const spawnPos = new Vec3(myPos.x + rightX, 0.03, myPos.z + rightZ);

        const vfxNode = this.spawnFromPool(this.footstepPrefab, EnemyVFX._footstepPool, 1.6);
        if (vfxNode) {
            vfxNode.setWorldPosition(spawnPos);
            vfxNode.setScale(new Vec3(this.footstepScale, this.footstepScale, this.footstepScale));
            this.playParticles(vfxNode);
        }
    }

    // =========================================================================
    // 2. ĐÒN TẤN CÔNG (ATTACK VFX)
    // =========================================================================
    public playAttack(targetNode?: Node) {
        if (!this.attackPrefab) return;

        const myPos = this.node.worldPosition;
        let dir = new Vec3();

        if (targetNode && targetNode.isValid) {
            const tPos = targetNode.worldPosition;
            dir.set(tPos.x - myPos.x, 0, tPos.z - myPos.z);
            if (dir.lengthSqr() > 0.001) {
                dir.normalize();
            } else {
                dir.set(this.node.forward);
            }
        } else {
            dir.set(this.node.forward);
        }

        // Xuất hiện trước ngực quái 0.75m
        const spawnPos = new Vec3(myPos.x + dir.x * 0.75, myPos.y + 0.6, myPos.z + dir.z * 0.75);
        const angleY = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
        const rot = new Quat();
        Quat.fromEuler(rot, 0, angleY, 0);

        const vfxNode = this.spawnFromPool(this.attackPrefab, EnemyVFX._attackPool, 0.5);
        if (vfxNode) {
            vfxNode.setWorldPosition(spawnPos);
            vfxNode.setWorldRotation(rot);
            vfxNode.setScale(new Vec3(this.attackVfxScale, this.attackVfxScale, this.attackVfxScale));
            this.playParticles(vfxNode);
        }
    }

    // =========================================================================
    // 3. BỊ TRÚNG ĐÒN (HIT VFX - BONE IMPACT)
    // =========================================================================
    public playHit(attackerNode?: Node) {
        if (!this.hitPrefab) return;

        const myPos = this.node.worldPosition;
        // Xuất hiện ở giữa ngực quái kèm độ lệch ngẫu nhiên nhẹ
        const offsetX = (Math.random() - 0.5) * 0.2;
        const offsetZ = (Math.random() - 0.5) * 0.2;
        const spawnPos = new Vec3(myPos.x + offsetX, myPos.y + 0.75, myPos.z + offsetZ);

        const vfxNode = this.spawnFromPool(this.hitPrefab, EnemyVFX._hitPool, 0.5);
        if (vfxNode) {
            vfxNode.setWorldPosition(spawnPos);
            vfxNode.setScale(new Vec3(this.hitVfxScale, this.hitVfxScale, this.hitVfxScale));
            this.playParticles(vfxNode);
        }
    }

    // =========================================================================
    // 4. KHI QUÁI CHẾT (DEATH VFX - SMOKE & SPARKS EXPLOSION)
    // =========================================================================
    public playDeath() {
        if (this.deathClip && AudioManager.instance) {
            AudioManager.instance.playEnemyDieWithClip(this.deathClip);
        }

        if (!this.deathPrefab) return;

        const myPos = this.node.worldPosition;
        const spawnPos = new Vec3(myPos.x, myPos.y + 0.1, myPos.z);

        const vfxNode = this.spawnFromPool(this.deathPrefab, EnemyVFX._deathPool, 1.8);
        if (vfxNode) {
            vfxNode.setWorldPosition(spawnPos);
            vfxNode.setScale(new Vec3(this.deathVfxScale, this.deathVfxScale, this.deathVfxScale));
            this.playParticles(vfxNode);
        }
    }

    // =========================================================================
    // HELPER: QUẢN LÝ POOL & CONTAINER
    // =========================================================================
    private spawnFromPool(prefab: Prefab, pool: Node[], maxLife: number): Node | null {
        let vfxNode: Node = null;

        while (pool.length > 0) {
            const candidate = pool.pop();
            if (candidate && candidate.isValid) {
                vfxNode = candidate;
                break;
            }
        }

        if (!vfxNode) {
            vfxNode = instantiate(prefab);
        }

        const container = this.node.scene?.getChildByName('System')?.getChildByName('Pool')
            || this.node.scene;

        vfxNode.setParent(container);
        vfxNode.active = true;

        // Tự động thu hồi về Pool sau maxLife
        const returnNode = vfxNode;
        const targetPool = pool;
        this.scheduleOnce(() => {
            if (returnNode && returnNode.isValid) {
                returnNode.active = false;
                targetPool.push(returnNode);
            }
        }, maxLife);

        return vfxNode;
    }

    private playParticles(rootNode: Node) {
        if (!rootNode || !rootNode.isValid) return;
        const particles = rootNode.getComponentsInChildren(ParticleSystem);
        for (const p of particles) {
            if (p && p.isValid) {
                p.clear();
                p.play();
            }
        }
    }
}
