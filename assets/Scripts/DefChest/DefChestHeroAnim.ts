import {
    _decorator,
    Component,
    Node,
    Vec3,
    SkeletalAnimation,
    AnimationClip,
    SpriteRenderer,
} from 'cc';
import { DefChestHeroRole } from './DefChestTypes';
import { DefChestArenaBounds } from './DefChestArenaBounds';

const { ccclass, property } = _decorator;

const _tmpPos = new Vec3();

/**
 * DefChestHeroAnim — Chuyên trách hoạt ảnh SkeletalAnimation, khóa xương gốc (Root Motion Lock),
 * đồng bộ bóng đổ (shadow), ẩn/hiện vũ khí của Warrior và điệu nhảy ăn mừng Chiến Thắng.
 */
@ccclass('DefChestHeroAnim')
export class DefChestHeroAnim extends Component {
    @property({ type: SkeletalAnimation, tooltip: 'SkeletalAnimation của Hero' })
    public skeletalAnim: SkeletalAnimation = null;

    @property({ type: Node, tooltip: 'Xương gốc (Root_M / Hips) để khóa trôi Root Motion' })
    public rootBone: Node = null;

    @property({ type: Node, tooltip: '[Warrior] Node Dao găm khởi đầu (SM_dagger Socket/dagger)' })
    public warriorDaggerNode: Node = null;

    @property({ type: Node, tooltip: '[Warrior] Node Rìu 1 tay sau GD A (SM_dagger Socket/axe_Tier2)' })
    public warriorAxe1HNode: Node = null;

    @property({ type: Node, tooltip: '[Warrior] Node Rìu 2 tay sau GD B (SM_dagger Socket/two_handed_axe_Tier2)' })
    public warriorAxe2HNode: Node = null;

    private _clipIdle: string = '';
    private _clipRun: string = '';
    private _clipAttack: string = '';
    private _clipSkill: string = '';
    private _clipDie: string = '';
    private _currentClip: string = '';
    private _baseScale: Vec3 = new Vec3(1, 1, 1);
    private _victoryJumpTimer: number = 0;
    private _victoryJumpDelay: number = 0;

    protected onLoad(): void {
        this.node.getScale(this._baseScale);
        this.resolveRefs();
    }

    public resolveRefs(): void {
        if (!this.skeletalAnim) {
            this.skeletalAnim = this.node.getComponent(SkeletalAnimation)
                || this.node.getComponentInChildren(SkeletalAnimation);
        }
        if (this.skeletalAnim && this.skeletalAnim.clips) {
            for (let i = 0; i < this.skeletalAnim.clips.length; i++) {
                const clip = this.skeletalAnim.clips[i];
                if (!clip) continue;
                const n = clip.name.toLowerCase();
                if (n.includes('idle')) this._clipIdle = clip.name;
                else if (n.includes('run') || n.includes('walk') || n.includes('move')) this._clipRun = clip.name;
                else if (n.includes('skill') || n.includes('special')) this._clipSkill = clip.name;
                else if (n.includes('attack')) this._clipAttack = clip.name;
                else if (n.includes('die') || n.includes('death')) this._clipDie = clip.name;
            }
        }

        if (!this.rootBone) {
            this.rootBone = this.findDescendant(this.node, 'Root_M')
                || this.findDescendant(this.node, 'Hips')
                || this.findDescendant(this.node, 'Bip01');
        }

        // Bật cập nhật ma trận cho node shadow dưới chân nhân vật (tránh bị Baked Animation bỏ qua)
        const shadowSp = this.node.getComponentInChildren(SpriteRenderer);
        if (shadowSp && shadowSp.node) {
            (shadowSp.node as any).isSkipTransformUpdate = false;
        }

        // Tự động tìm 3 vũ khí trên Character_Warrior nếu chưa gắn
        const socket = this.findDescendant(this.node, 'SM_dagger Socket');
        if (socket) {
            if (!this.warriorDaggerNode) this.warriorDaggerNode = socket.getChildByName('dagger');
            if (!this.warriorAxe1HNode) this.warriorAxe1HNode = socket.getChildByName('axe_Tier2');
            if (!this.warriorAxe2HNode) this.warriorAxe2HNode = socket.getChildByName('two_handed_axe_Tier2');
        }

        // Tắt triệt để FX_Dagger1_Attack nếu tồn tại
        const legacyDaggerFx = this.node.getChildByName('FX_Dagger1_Attack');
        if (legacyDaggerFx) legacyDaggerFx.active = false;
    }

    private findDescendant(root: Node, targetName: string): Node | null {
        if (!root) return null;
        if (root.name === targetName) return root;
        for (let i = 0; i < root.children.length; i++) {
            const f = this.findDescendant(root.children[i], targetName);
            if (f) return f;
        }
        return null;
    }

    public setWarriorWeaponStage(role: string, stage: number): void {
        if (role !== DefChestHeroRole.WARRIOR) return;
        this.resolveRefs();
        if (this.warriorDaggerNode) this.warriorDaggerNode.active = (stage === 1);
        if (this.warriorAxe1HNode) this.warriorAxe1HNode.active = (stage === 2);
        if (this.warriorAxe2HNode) this.warriorAxe2HNode.active = (stage >= 3);
    }

    public playIdle(force: boolean = false): void {
        this.resolveRefs();
        if (!this.skeletalAnim || !this._clipIdle) return;
        const state = this.skeletalAnim.getState(this._clipIdle);
        if (!force && this._currentClip === this._clipIdle && state && state.isPlaying) {
            return;
        }
        this._currentClip = this._clipIdle;
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Loop;
            state.repeatCount = Infinity;
            state.speed = 1.0;
        }
        this.skeletalAnim.crossFade(this._clipIdle, 0.12);
    }

    public playRun(): void {
        this.resolveRefs();
        const clip = this._clipRun || this._clipIdle;
        if (!this.skeletalAnim || !clip) return;
        const state = this.skeletalAnim.getState(clip);
        if (this._currentClip === clip && state && state.isPlaying) {
            return;
        }
        this._currentClip = clip;
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Loop;
            state.repeatCount = Infinity;
            state.speed = 1.25;
        }
        this.skeletalAnim.crossFade(clip, 0.10);
    }

    public playAttack(useSkillClip: boolean = false, speed: number = 1.65): void {
        this.resolveRefs();
        const clip = (useSkillClip && this._clipSkill) ? this._clipSkill : (this._clipAttack || this._clipIdle);
        if (!this.skeletalAnim || !clip) return;

        this._currentClip = clip;
        const state = this.skeletalAnim.getState(clip);
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Normal;
            state.repeatCount = 1;
            state.speed = speed;
            state.setTime(0);
        }
        this.skeletalAnim.crossFade(clip, 0.08);
    }

    public playDie(): void {
        this.resolveRefs();
        if (!this.skeletalAnim || !this._clipDie) return;
        this._currentClip = this._clipDie;
        const state = this.skeletalAnim.getState(this._clipDie);
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Normal;
            state.repeatCount = 1;
            state.speed = 1.0;
            state.setTime(0);
        }
        this.skeletalAnim.crossFade(this._clipDie, 0.10);
    }

    public startVictoryJump(staggerDelaySec: number = 0): void {
        this._victoryJumpDelay = Math.max(0, staggerDelaySec);
        this._victoryJumpTimer = 0;
        this.playIdle(true);
    }

    public updateVictoryJump(dt: number): void {
        if (this._victoryJumpDelay > 0) {
            this._victoryJumpDelay -= dt;
            return;
        }
        this._victoryJumpTimer += dt * 7.2;
        const groundY = DefChestArenaBounds.instance ? DefChestArenaBounds.instance.groundY : 0.32;
        const bounceSin = Math.abs(Math.sin(this._victoryJumpTimer));
        const jumpHeight = 0.68;

        this.node.getWorldPosition(_tmpPos);
        _tmpPos.y = groundY + bounceSin * jumpHeight;
        this.node.setWorldPosition(_tmpPos);

        const stretchY = 1.0 + (bounceSin - 0.35) * 0.14;
        const squashXZ = 1.0 - (bounceSin - 0.35) * 0.07;
        this.node.setScale(
            this._baseScale.x * squashXZ,
            this._baseScale.y * stretchY,
            this._baseScale.z * squashXZ
        );
    }

    protected lateUpdate(): void {
        // Khóa Root Motion XZ trên xương gốc để nhân vật không bị giật/trượt vị trí do animation
        if (this.rootBone && this.rootBone.isValid) {
            const p = this.rootBone.position;
            if (p.x !== 0 || p.z !== 0) {
                this.rootBone.setPosition(0, p.y, 0);
            }
        }
    }
}
