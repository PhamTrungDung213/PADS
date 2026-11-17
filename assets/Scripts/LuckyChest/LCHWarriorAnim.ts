import { _decorator, Component, Node, Prefab, instantiate, Vec3, Color, Material, SkeletalAnimation, ParticleSystem } from 'cc';
import { PaladinGroundFx } from '../VFX/PaladinGroundFx';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('LCHWarriorAnim')
export class LCHWarriorAnim extends Component {
    @property({ type: SkeletalAnimation, tooltip: 'SkeletalAnimation trên Character_Warrior' })
    public skeletalAnim: SkeletalAnimation = null;

    @property({ type: Node, tooltip: 'Xương gốc Root_M để khóa Root Motion' })
    public rootBone: Node = null;

    @property({ type: Node, tooltip: 'Node bóng dưới chân Character_Warrior/shadow' })
    public shadowNode: Node = null;

    @property({ type: Node, tooltip: 'Container chứa các hiệu ứng VFX (System/Pool)' })
    public vfxContainer: Node = null;

    @property({ type: Prefab, tooltip: 'Khói bước chân (FX_Smoke_Step.prefab)' })
    public footstepPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Cột sáng nhận vũ khí mới (FX_LevelUp.prefab)' })
    public levelUpPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng máu khi Warrior bị đánh (FX_common_impact_blood.prefab)' })
    public heroHitBloodPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói khi Warrior gục ngã (FX_Smoke_Die.prefab)' })
    public deathSmokePrefab: Prefab = null;

    @property({ type: Material, tooltip: 'Material vòng sáng dưới đất (WA_Ring.mtl)' })
    public ringMaterial: Material = null;

    @property({ type: Material, tooltip: 'Material vệt quạt vũ khí (WA_Swoosh.mtl)' })
    public swooshMaterial: Material = null;

    private _currentAnim: string = '';
    private _stepTimer: number = 0;
    private _isLeftFoot: boolean = false;
    private _footstepPool: Node[] = [];
    private _bloodPool: Node[] = [];
    private _myPos: Vec3 = new Vec3();

    protected onLoad(): void {
        if (this.ringMaterial) PaladinGroundFx.material = this.ringMaterial;
        if (this.swooshMaterial) PaladinGroundFx.swooshMat = this.swooshMaterial;
        if (this.vfxContainer) PaladinGroundFx.root = this.vfxContainer;
    }

    public playAnim(name: string, loop: boolean, fadeTime: number = 0.1): void {
        if (!this.skeletalAnim) return;
        if (this._currentAnim === name && loop) return;
        this._currentAnim = name;
        this.skeletalAnim.crossFade(name, fadeTime);
    }

    public updateFootstep(dt: number, moving: boolean, facingDir: Vec3): void {
        if (!moving || !this.footstepPrefab || !this.vfxContainer) {
            this._stepTimer = 0;
            return;
        }
        this._stepTimer += dt;
        if (this._stepTimer >= 0.22) {
            this._stepTimer = 0;
            this._isLeftFoot = !this._isLeftFoot;
            this.node.getWorldPosition(this._myPos);
            const side = this._isLeftFoot ? -0.18 : 0.18;
            const sx = this._myPos.x - facingDir.z * side;
            const sz = this._myPos.z + facingDir.x * side;

            let puff = this._footstepPool.pop();
            if (!puff || !puff.isValid) puff = instantiate(this.footstepPrefab);
            puff.setParent(this.vfxContainer);
            puff.setWorldPosition(sx, 0.03, sz);
            puff.setScale(0.75, 0.75, 0.75);
            puff.active = true;
            this.restartParticles(puff);

            this.scheduleOnce(() => {
                if (puff && puff.isValid) {
                    puff.active = false;
                    this._footstepPool.push(puff);
                }
            }, 0.55);
        }
    }

    public playWeaponUpgradeFx(stage: number): void {
        this.node.getWorldPosition(this._myPos);
        if (this.levelUpPrefab && this.vfxContainer) {
            const fx = instantiate(this.levelUpPrefab);
            fx.setParent(this.vfxContainer);
            fx.setWorldPosition(this._myPos.x, 0.05, this._myPos.z);
            fx.setScale(1.15, 1.15, 1.15);
            fx.active = true;
            this.restartParticles(fx);
            this.scheduleOnce(() => {
                if (fx && fx.isValid) fx.destroy();
            }, 2.2);
        }

        const ringColor = stage === 2 ? new Color(195, 110, 255, 255) : new Color(255, 215, 70, 255);
        PaladinGroundFx.ring(this._myPos, {
            from: 0.4,
            to: 2.8,
            duration: 0.55,
            color: ringColor,
            easing: 'cubicOut',
        });
    }

    public playBloodHitFx(): void {
        if (!this.heroHitBloodPrefab || !this.vfxContainer) return;
        let blood = this._bloodPool.pop();
        if (!blood || !blood.isValid) blood = instantiate(this.heroHitBloodPrefab);
        this.node.getWorldPosition(this._myPos);
        blood.setParent(this.vfxContainer);
        blood.setWorldPosition(this._myPos.x, 0.9, this._myPos.z);
        blood.setScale(0.85, 0.85, 0.85);
        blood.active = true;
        this.restartParticles(blood);

        this.scheduleOnce(() => {
            if (blood && blood.isValid) {
                blood.active = false;
                this._bloodPool.push(blood);
            }
        }, 0.5);
    }

    public playDeathFx(): void {
        this.playAnim('die', false, 0.08);
        this.node.getWorldPosition(this._myPos);
        if (this.deathSmokePrefab && this.vfxContainer) {
            const smoke = instantiate(this.deathSmokePrefab);
            smoke.setParent(this.vfxContainer);
            smoke.setWorldPosition(this._myPos.x, 0.15, this._myPos.z);
            smoke.setScale(1.35, 1.35, 1.35);
            smoke.active = true;
            this.restartParticles(smoke);
        }
        if (AudioManager.instance) {
            AudioManager.instance.playEnemyDie();
        }
    }

    public restartParticles(rootNode: Node): void {
        const ps = rootNode.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < ps.length; i++) {
            ps[i].clear();
            ps[i].play();
        }
    }

    protected lateUpdate(): void {
        if (this.rootBone && this.rootBone.isValid) {
            const p = this.rootBone.position;
            if (Math.abs(p.x) > 0.001 || Math.abs(p.z) > 0.001) {
                this.rootBone.setPosition(0, p.y, 0);
            }
        }
        if (this.shadowNode && this.shadowNode.isValid) {
            this.shadowNode.setPosition(0, 0.02, 0);
        }
    }
}
