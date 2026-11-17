import { _decorator, Component, Prefab, instantiate, Node, Vec3, CCFloat, ParticleSystem, assetManager, Material } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';
import { CharacterState } from '../Char/CharacterState';
import { PaladinGroundFx } from './PaladinGroundFx';

const { ccclass, property } = _decorator;

@ccclass('CharVFX')
export class CharVFX extends Component {
    public static instance: CharVFX = null;

    // ==========================================
    // NHÓM 1: CÁC PREFAB VFX PALADIN CHÍNH (THEO README.MD)
    // ==========================================
    @property({ type: Prefab, tooltip: 'Tia nhỏ khi sách đập trúng quái (FX_FireBolt_impact)' })
    public hitSparkPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Sét đánh xuống (FX_Lightning_Blue)' })
    public lightningPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Tia vàng: Choáng / Nổ thánh (FX_Lighting_Explosion)' })
    public holyBurstPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Bùng nắng nhỏ trên quái (FX_Fireball_impact)' })
    public sunBurstPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Lửa cháy trên người quái (FX_Burn)' })
    public burnPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Bùng lửa lớn (FX_FireInferno_impact)' })
    public fireBlastPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Vòm vàng bảo hộ (FX_StarCombo_Full)' })
    public goldDomePrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Cột sáng thánh (FX_LevelUp)' })
    public levelUpPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Nổ lớn ở tâm (FX_Fire_Explosion)' })
    public bigBlastPrefab: Prefab = null;

    @property({ type: Material, tooltip: 'Vật liệu vòng sáng chân (WA_Ring)' })
    public ringMaterial: Material = null;

    @property({ type: Material, tooltip: 'Vật liệu nhát chém kiếm (WA_Swoosh)' })
    public swooshMaterial: Material = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói quái chết (FX_Smoke_Die)' })
    public enemyDeathPrefab: Prefab = null;

    // ==========================================
    // NHÓM 2: DẤU CHÂN & SCALE
    // ==========================================
    @property({ type: Prefab, tooltip: 'Khói bước chân nhân vật (FX_Smoke_Step)' })
    public footstepPrefab: Prefab = null;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ phóng to khói bước chân' })
    public footstepScale: number = 0.9;

    @property({ type: CCFloat, tooltip: 'Khoảng cách thời gian giữa các nhịp bước chân (giây)' })
    public stepInterval: number = 0.2;

    @property({ type: CCFloat, tooltip: 'Tỉ lệ phóng to hiệu ứng Level Up' })
    public levelUpScale: number = 1.0;

    // Vòm vàng bảo hộ đang gắn trên Hero
    private _goldDomeInstance: Node | null = null;

    // Quản lý lửa cháy trên tối đa 8 quái (Tránh lag FPS theo README)
    private _burningEnemies: Map<Node, Node> = new Map<Node, Node>();
    public static readonly MAX_BURN_COUNT: number = 8;

    // Footstep runtime
    private _charState: CharacterState | null = null;
    private _stepTimer: number = 0;
    private _isLeftFoot: boolean = false;
    private _activeFootsteps: { node: Node; elapsed: number; maxLife: number }[] = [];

    // Static Pool quản lý các hiệu ứng ngắn
    private _hitSparkPool: Node[] = [];
    private _lightningPool: Node[] = [];
    private _holyBurstPool: Node[] = [];
    private _sunBurstPool: Node[] = [];
    private _burnPool: Node[] = [];
    private _footstepPool: Node[] = [];
    private _levelUpPool: Node[] = [];

    onLoad() {
        CharVFX.instance = this;

        if (this.ringMaterial) PaladinGroundFx.material = this.ringMaterial;
        if (this.swooshMaterial) PaladinGroundFx.swooshMat = this.swooshMaterial;

        this._charState = this.getComponent(CharacterState)
            || this.node.parent?.getComponent(CharacterState);

        // Nạp tự động toàn bộ Prefab Paladin nếu chưa gán thủ công trên Inspector
        this.preloadDefaultPrefabs();

        EventManager.instance.on(GameEvent.SKILL_SELECTED, this.onSkillSelected, this);
        EventManager.instance.on(GameEvent.SCREEN_CLEAR, this.onScreenClear, this);
        EventManager.instance.on(GameEvent.LEVEL_UP, this.onLevelUp, this);
    }

    onDestroy() {
        if (CharVFX.instance === this) {
            CharVFX.instance = null;
        }
        EventManager.instance.off(GameEvent.SKILL_SELECTED, this.onSkillSelected, this);
        EventManager.instance.off(GameEvent.SCREEN_CLEAR, this.onScreenClear, this);
        EventManager.instance.off(GameEvent.LEVEL_UP, this.onLevelUp, this);

        this.clearAllBurnFx();

        if (this._goldDomeInstance && this._goldDomeInstance.isValid) {
            this._goldDomeInstance.destroy();
            this._goldDomeInstance = null;
        }

        for (const item of this._activeFootsteps) {
            if (item.node && item.node.isValid) item.node.destroy();
        }
        this._activeFootsteps.length = 0;
    }

    private preloadDefaultPrefabs() {
        const load = (uuid: string, cb: (p: Prefab) => void) => {
            assetManager.loadAny(uuid, (err, asset: Prefab) => {
                if (!err && asset) cb(asset);
            });
        };

        if (!this.hitSparkPrefab) load('8b3af389-cd0c-4551-ad3a-f018d8345ccb', p => this.hitSparkPrefab = p);
        if (!this.lightningPrefab) load('86768a64-1f15-42f2-ba38-613e33286f43', p => this.lightningPrefab = p);
        if (!this.holyBurstPrefab) load('bacb2fc6-d5b0-402a-8b11-d4c2258d437a', p => this.holyBurstPrefab = p);
        if (!this.sunBurstPrefab) load('2358db51-e474-40f5-967d-6f76184729e2', p => this.sunBurstPrefab = p);
        if (!this.burnPrefab) load('29ae4751-5055-4d24-be1b-ffe46e75b5cc', p => this.burnPrefab = p);
        if (!this.fireBlastPrefab) load('284e5075-25d8-4069-8aa7-bde86d8a1b1f', p => this.fireBlastPrefab = p);
        if (!this.goldDomePrefab) load('8912d4e8-fd6d-49f2-a8c8-6ca16f086132', p => this.goldDomePrefab = p);
        if (!this.levelUpPrefab) load('60e76d4a-d0e8-4130-899a-f37711c531f1', p => this.levelUpPrefab = p);
        if (!this.bigBlastPrefab) load('9f0cab4c-d710-4773-b6cc-e2e78a560dfd', p => this.bigBlastPrefab = p);
        if (!this.footstepPrefab) load('705f710f-a771-4f1b-8420-2d8c13018e12', p => this.footstepPrefab = p);
    }

    update(dt: number) {
        this.updateFootstep(dt);
        this.updateActiveFootsteps(dt);
    }

    // =========================================================================
    // 1. TIA SÁNG ĐẬP TRÚNG QUÁI (HIT SPARKS - FX_FireBolt_impact)
    // =========================================================================
    public playHitSpark(pos: Vec3) {
        if (!this.hitSparkPrefab) return;
        const vfx = this.spawnFromPool(this.hitSparkPrefab, this._hitSparkPool, 0.7);
        if (vfx) {
            vfx.setWorldPosition(pos.x, pos.y + 0.8, pos.z);
            vfx.setScale(new Vec3(0.85, 0.85, 0.85));
            this.playParticles(vfx);
        }
    }

    // =========================================================================
    // 2. SÉT ĐÁNH XUỐNG QUÁI (THUNDER STRIKE - FX_Lightning_Blue)
    // =========================================================================
    public playLightningStrike(pos: Vec3) {
        if (!this.lightningPrefab) return;
        const vfx = this.spawnFromPool(this.lightningPrefab, this._lightningPool, 0.75);
        if (vfx) {
            vfx.setWorldPosition(pos.x, pos.y, pos.z);
            vfx.setScale(new Vec3(1.45, 1.45, 1.45));
            this.playParticles(vfx);
        }
    }

    // =========================================================================
    // 3. NỔ VÀNG THÁNH / CHOÁNG BONK (HOLY BURST - FX_Lighting_Explosion)
    // =========================================================================
    public playHolyBurst(pos: Vec3, scale: number = 0.9) {
        if (!this.holyBurstPrefab) return;
        const vfx = this.spawnFromPool(this.holyBurstPrefab, this._holyBurstPool, 0.9);
        if (vfx) {
            vfx.setWorldPosition(pos.x, pos.y + 0.3, pos.z);
            vfx.setScale(new Vec3(scale, scale, scale));
            this.playParticles(vfx);
        }
    }

    // =========================================================================
    // 4. BÙNG NẮNG MẶT TRỜI (SUN BURST - FX_Fireball_impact)
    // =========================================================================
    public playSunBurst(pos: Vec3) {
        if (!this.sunBurstPrefab) return;
        const vfx = this.spawnFromPool(this.sunBurstPrefab, this._sunBurstPool, 0.8);
        if (vfx) {
            vfx.setWorldPosition(pos.x, pos.y + 0.7, pos.z);
            vfx.setScale(new Vec3(0.8, 0.8, 0.8));
            this.playParticles(vfx);
        }
    }

    // =========================================================================
    // 5. BÙNG LỬA LỚN (FIRE INFERNO BLAST - FX_FireInferno_impact)
    // =========================================================================
    public playFireBlast(pos: Vec3, scale: number = 1.0) {
        if (!this.fireBlastPrefab) return;
        PaladinGroundFx.prefab(this.fireBlastPrefab, pos, scale, 1.2);
    }

    // =========================================================================
    // 6. GẮN LỬA CHÁY TRÊN QUÁI (BURN BURN BURN - FX_Burn) - TỐI ĐA 8 QUÁI
    // =========================================================================
    public attachBurn(enemyNode: Node) {
        if (!enemyNode || !enemyNode.isValid || !this.burnPrefab) return;
        if (this._burningEnemies.has(enemyNode)) return;

        // Giới hạn tối đa 8 quái có lửa theo đúng GD để giữ FPS
        if (this._burningEnemies.size >= CharVFX.MAX_BURN_COUNT) return;

        let burnNode: Node = null;
        if (this._burnPool.length > 0) {
            burnNode = this._burnPool.pop()!;
        } else {
            burnNode = instantiate(this.burnPrefab);
        }

        burnNode.setParent(enemyNode);
        burnNode.setPosition(0, 0.3, 0);
        burnNode.setScale(new Vec3(0.7, 0.7, 0.7));
        burnNode.active = true;
        this.playParticles(burnNode);

        this._burningEnemies.set(enemyNode, burnNode);
    }

    public detachBurn(enemyNode: Node) {
        if (!enemyNode) return;
        const burnNode = this._burningEnemies.get(enemyNode);
        if (burnNode) {
            this._burningEnemies.delete(enemyNode);
            if (burnNode.isValid) {
                burnNode.active = false;
                burnNode.setParent(this.getPoolContainer());
                this._burnPool.push(burnNode);
            }
        }
    }

    private clearAllBurnFx() {
        this._burningEnemies.forEach((burnNode) => {
            if (burnNode && burnNode.isValid) {
                burnNode.destroy();
            }
        });
        this._burningEnemies.clear();
    }

    // =========================================================================
    // 7. VÒM VÀNG BẢO HỘ (PROTECTIVE AURA DOME - FX_StarCombo_Full)
    // =========================================================================
    public showProtectiveDome(show: boolean = true) {
        if (!this.goldDomePrefab) return;

        if (show) {
            if (!this._goldDomeInstance || !this._goldDomeInstance.isValid) {
                this._goldDomeInstance = instantiate(this.goldDomePrefab);
                this._goldDomeInstance.setParent(this.node);
                this._goldDomeInstance.setPosition(0, 0.05, 0);
                this._goldDomeInstance.setScale(new Vec3(1.15, 1.15, 1.15));
            }
            this._goldDomeInstance.active = true;
            this.playParticles(this._goldDomeInstance);
        } else {
            if (this._goldDomeInstance && this._goldDomeInstance.isValid) {
                this._goldDomeInstance.active = false;
            }
        }
    }

    // =========================================================================
    // 8. CỘT SÁNG THĂNG CẤP & CHIÊU CUỐI (LEVEL UP & SCREEN CLEAR)
    // =========================================================================
    public playLevelUp(scale: number = 1.0) {
        if (!this.levelUpPrefab) return;

        let lvlNode: Node = null;
        if (this._levelUpPool.length > 0) {
            lvlNode = this._levelUpPool.pop()!;
        } else {
            lvlNode = instantiate(this.levelUpPrefab);
        }

        lvlNode.setParent(this.node);
        lvlNode.setPosition(0, 0.05, 0);
        lvlNode.setScale(new Vec3(scale, scale, scale));
        lvlNode.active = true;
        this.playParticles(lvlNode);

        this.scheduleOnce(() => {
            if (lvlNode && lvlNode.isValid) {
                lvlNode.active = false;
                this._levelUpPool.push(lvlNode);
            }
        }, 2.5);
    }

    // =========================================================================
    // 9. DẤU CHÂN ĐỘC LẬP TRÊN MẶT ĐẤT (INDEPENDENT FOOTSTEP)
    // =========================================================================
    private updateFootstep(dt: number) {
        if (!this.footstepPrefab) return;
        const isMoving = this._charState ? this._charState.isMoving() : false;

        if (isMoving) {
            this._stepTimer += dt;
            if (this._stepTimer >= this.stepInterval) {
                this._stepTimer = 0;
                this.spawnFootstepPuff();
            }
        } else {
            this._stepTimer = 0;
        }
    }

    private updateActiveFootsteps(dt: number) {
        for (let i = this._activeFootsteps.length - 1; i >= 0; i--) {
            const item = this._activeFootsteps[i];
            item.elapsed += dt;
            if (item.elapsed >= item.maxLife) {
                if (item.node && item.node.isValid) {
                    item.node.active = false;
                    this._footstepPool.push(item.node);
                }
                this._activeFootsteps.splice(i, 1);
            }
        }
    }

    private spawnFootstepPuff() {
        if (!this.footstepPrefab) return;

        const charNode = this._charState ? this._charState.node : this.node;
        const heroPos = charNode.worldPosition;
        const facing = this._charState ? this._charState.getFacing() : new Vec3(0, 0, -1);

        this._isLeftFoot = !this._isLeftFoot;
        const sideOffset = this._isLeftFoot ? -0.2 : 0.2;
        const spawnX = heroPos.x - facing.z * sideOffset;
        const spawnZ = heroPos.z + facing.x * sideOffset;
        const spawnPos = new Vec3(spawnX, 0.03, spawnZ);

        let puffNode: Node = null;
        if (this._footstepPool.length > 0) {
            puffNode = this._footstepPool.pop()!;
        } else {
            puffNode = instantiate(this.footstepPrefab);
        }

        puffNode.setParent(this.getPoolContainer());
        puffNode.setWorldPosition(spawnPos);
        puffNode.setScale(new Vec3(this.footstepScale, this.footstepScale, this.footstepScale));
        puffNode.active = true;
        this.playParticles(puffNode);

        // Giới hạn tối đa 6 khói bước chân đồng thời cho Hero để tránh tràn pool
        if (this._activeFootsteps.length >= 6) {
            const oldest = this._activeFootsteps.shift();
            if (oldest && oldest.node && oldest.node.isValid) {
                oldest.node.active = false;
                this._footstepPool.push(oldest.node);
            }
        }

        this._activeFootsteps.push({
            node: puffNode,
            elapsed: 0,
            maxLife: 0.6
        });
    }

    // =========================================================================
    // XỬ LÝ SỰ KIỆN NÂNG CẤP SKILL
    // =========================================================================
    private onSkillSelected(skillId: string) {
        if (skillId === 'aura_protective') {
            this.showProtectiveDome(true);
        } else if (skillId === 'burn_burn_burn') {
            const pos = this.node.worldPosition;
            this.playFireBlast(pos, 1.2);
        } else if (skillId === 'righteous_fury') {
            this.playLevelUp(1.4);
        }
    }

    private onScreenClear() {
        this.playLevelUp(2.6);
    }

    private onLevelUp(level?: number) {
        this.playLevelUp(this.levelUpScale);
    }

    // =========================================================================
    // HELPER TÁI CHẾ POOL
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

        vfxNode.setParent(this.getPoolContainer());
        vfxNode.active = true;

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

    private getPoolContainer(): Node {
        return (this.node.scene?.getChildByName('System')?.getChildByName('Pool') || this.node.scene) as unknown as Node;
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
