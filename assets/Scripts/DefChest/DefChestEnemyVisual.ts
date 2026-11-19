import {
    _decorator,
    Component,
    Node,
    Prefab,
    Material,
    SkeletalAnimation,
    SkinnedMeshRenderer,
    AnimationClip,
    ParticleSystem,
    Vec3,
    instantiate,
    assetManager,
    js,
} from 'cc';
import { DefChestConfig } from './DefChestConfig';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { BarAttacher, BarAttacherMode } from '../UI/BarAttacher';

const _tmpEnemyJumpPos = new Vec3();

const { ccclass, property } = _decorator;

const OUTLINE_RED_MAT_UUID = '5497c296-9cf2-4938-9134-b5759dca306f';

/**
 * DefChestEnemyVisual — Chuyên trách hoạt ảnh SkeletalAnimation của Quái,
 * khóa Root Motion xương gốc, gắn viền đỏ `Enemy_Skeleton_Outline` (giữ nguyên màu xương gốc)
 * và hiển thị hiệu ứng cháy Burn DoT.
 */
@ccclass('DefChestEnemyVisual')
export class DefChestEnemyVisual extends Component {
    @property({ type: SkeletalAnimation, tooltip: 'SkeletalAnimation của Quái' })
    public skeletalAnim: SkeletalAnimation = null;

    @property({ type: Node, tooltip: 'Xương gốc (Root_M / Hips / Bip01) để khóa Root Motion' })
    public rootBone: Node = null;

    @property({ type: Material, tooltip: 'Material viền đỏ cho Quái (M_DefChest_Skeleton_OutlineRed)' })
    public outlineRedMat: Material = null;

    private _clipIdle: string = '';
    private _clipWalk: string = '';
    private _clipAttack: string = '';
    private _clipSkill: string = '';
    private _clipDie: string = '';
    private _currentClip: string = '';
    private _burnFxNode: Node | null = null;
    private _victoryJumpTimer: number = 0;
    private _victoryJumpDelay: number = 0;
    private _victoryBaseScale: Vec3 = new Vec3(1, 1, 1);

    /**
     * Gỡ toàn bộ script cũ của Survival (EnemyMovement, EnemyAnimation, Enemy, Test...)
     * và gắn sẵn child `Enemy_Skeleton_Outline` TRƯỚC KHI node được gắn vào Scene Tree.
     * Nhờ đó `SkeletalAnimation.onLoad()` tự động nhận diện cả 2 SkinnedMeshRenderer cho Baked Animation!
     */
    public static preparePrefabInstanceBeforeMount(
        rootNode: Node,
        isElite: boolean,
        outlineMat?: Material | null
    ): void {
        const keepNames = new Set([
            'DefChestEnemyController',
            'DefChestEnemyVisual',
            'DefChestEnemyCombat',
            'DefChestEnemyLocomotion',
            'BarAttacher',
            'Test',
        ]);
        const comps = rootNode.getComponentsInChildren(Component);
        for (let i = 0; i < comps.length; i++) {
            const c = comps[i];
            if (!c) continue;
            if (c instanceof BarAttacher) {
                c.manualMode = BarAttacherMode.ENEMY_HP;
                continue;
            }
            const cname = js.getClassName(c);
            if (cname && !cname.startsWith('cc.') && !keepNames.has(cname)) {
                c.destroy();
            }
        }

        if (!isElite && outlineMat) {
            this.attachRedOutlineMesh(rootNode, outlineMat);
        }
    }

    public static attachRedOutlineMesh(rootNode: Node, mat: Material): void {
        let outlineNode = rootNode.getChildByName('Enemy_Skeleton_Outline');
        if (outlineNode) {
            const existingSmr = outlineNode.getComponent(SkinnedMeshRenderer);
            if (existingSmr && existingSmr.getSharedMaterial(0) === mat) {
                return;
            }
        }

        const mainSmr = rootNode.getComponentInChildren(SkinnedMeshRenderer);
        if (!mainSmr || !mainSmr.mesh) return;

        const isNewNode = !outlineNode;
        if (!outlineNode) {
            outlineNode = new Node('Enemy_Skeleton_Outline');
            outlineNode.layer = mainSmr.node.layer;
            outlineNode.setParent(mainSmr.node.parent || rootNode);
            outlineNode.setPosition(mainSmr.node.position);
            outlineNode.setRotation(mainSmr.node.rotation);
            outlineNode.setScale(mainSmr.node.scale);
        }

        const outlineSmr = outlineNode.getComponent(SkinnedMeshRenderer)
            || outlineNode.addComponent(SkinnedMeshRenderer);
        outlineSmr.mesh = mainSmr.mesh;
        outlineSmr.skeleton = mainSmr.skeleton;
        outlineSmr.skinningRoot = mainSmr.skinningRoot || rootNode;
        outlineSmr.setSharedMaterial(mat, 0);

        if (isNewNode && rootNode.parent) {
            const sa = rootNode.getComponent(SkeletalAnimation)
                || rootNode.getComponentInChildren(SkeletalAnimation);
            if (sa && sa.isValid && sa.useBakedAnimation) {
                sa.useBakedAnimation = false;
                sa.useBakedAnimation = true;
            }
        }
    }

    protected onLoad(): void {
        this.resolveClipsAndBones();
    }

    public resolveClipsAndBones(): void {
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
                else if (n.includes('walk') || n.includes('run')) this._clipWalk = clip.name;
                else if (n.includes('special') || n.includes('skill')) this._clipSkill = clip.name;
                else if (n.includes('attack')) this._clipAttack = clip.name;
                else if (n.includes('death') || n.includes('die')) this._clipDie = clip.name;
            }
            if (!this._clipWalk && this.skeletalAnim.defaultClip) {
                this._clipWalk = this.skeletalAnim.defaultClip.name;
            }
            if (!this._clipIdle) {
                this._clipIdle = this._clipWalk;
            }
        }

        if (!this.rootBone) {
            this.rootBone = this.findBone(this.node, 'Root_M')
                || this.findBone(this.node, 'Root')
                || this.findBone(this.node, 'Hips')
                || this.findBone(this.node, 'Bip01');
        }
    }

    private findBone(parent: Node, name: string): Node | null {
        if (!parent) return null;
        if (parent.name === name) return parent;
        for (let i = 0; i < parent.children.length; i++) {
            const found = this.findBone(parent.children[i], name);
            if (found) return found;
        }
        return null;
    }

    public ensureRedOutline(isElite: boolean, customMat?: Material | null): void {
        if (isElite) return;
        const mat = customMat || this.outlineRedMat || DefChestConfig.instance?.enemyOutlineRedMat;
        if (mat) {
            this.outlineRedMat = mat;
            DefChestEnemyVisual.attachRedOutlineMesh(this.node, mat);
        } else {
            assetManager.loadAny(OUTLINE_RED_MAT_UUID, (err, loadedMat: Material) => {
                if (!err && loadedMat && this.isValid && this.node.isValid) {
                    this.outlineRedMat = loadedMat;
                    DefChestEnemyVisual.attachRedOutlineMesh(this.node, loadedMat);
                }
            });
        }
    }

    public resetAnimState(): void {
        this._currentClip = '';
    }

    public playWalk(force: boolean = false): void {
        this.resolveClipsAndBones();
        const clip = this._clipWalk || this._clipIdle;
        if (!this.skeletalAnim || !clip) return;

        const state = this.skeletalAnim.getState(clip);
        if (!force && this._currentClip === clip && state && state.isPlaying) {
            return;
        }
        this._currentClip = clip;
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Loop;
            state.repeatCount = Infinity;
            state.speed = 1.15;
        }
        this.skeletalAnim.crossFade(clip, 0.12);
    }

    public playIdle(): void {
        this.resolveClipsAndBones();
        const clip = this._clipIdle || this._clipWalk;
        if (!this.skeletalAnim || !clip) return;

        const state = this.skeletalAnim.getState(clip);
        if (this._currentClip === clip && state && state.isPlaying) {
            return;
        }
        this._currentClip = clip;
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Loop;
            state.repeatCount = Infinity;
            state.speed = 1.0;
        }
        this.skeletalAnim.crossFade(clip, 0.12);
    }

    public playAttack(isSpecialSkill: boolean = false): void {
        this.resolveClipsAndBones();
        const clip = (isSpecialSkill && this._clipSkill)
            ? this._clipSkill
            : (this._clipAttack || this._clipWalk);
        if (!this.skeletalAnim || !clip) return;

        this._currentClip = clip;
        const state = this.skeletalAnim.getState(clip);
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Normal;
            state.repeatCount = 1;
            state.speed = isSpecialSkill ? 1.25 : 1.35;
            state.setTime(0);
        }
        this.skeletalAnim.crossFade(clip, 0.08);
    }

    public playDie(): void {
        this.resolveClipsAndBones();
        if (!this.skeletalAnim || !this._clipDie) return;

        this._currentClip = this._clipDie;
        const state = this.skeletalAnim.getState(this._clipDie);
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Normal;
            state.repeatCount = 1;
            state.speed = 1.1;
            state.setTime(0);
        }
        this.skeletalAnim.crossFade(this._clipDie, 0.08);
    }

    public attachBurnLoop(burnPrefab?: Prefab | null): void {
        if (this._burnFxNode || !burnPrefab) return;
        const fx = instantiate(burnPrefab);
        fx.setParent(this.node);
        fx.setPosition(0, 0.6, 0);
        fx.setScale(0.75, 0.75, 0.75);
        this._burnFxNode = fx;
        const psList = fx.getComponentsInChildren(ParticleSystem);
        for (let i = 0; i < psList.length; i++) {
            psList[i].stop();
            psList[i].clear();
            psList[i].play();
        }
    }

    public clearBurnLoop(): void {
        if (this._burnFxNode && this._burnFxNode.isValid) {
            this._burnFxNode.destroy();
        }
        this._burnFxNode = null;
    }

    public startVictoryJump(staggerDelaySec: number = 0): void {
        this._victoryJumpDelay = Math.max(0, staggerDelaySec);
        this._victoryJumpTimer = 0;
        this.node.getScale(this._victoryBaseScale);
        this.playIdle();
    }

    public updateVictoryJump(dt: number): void {
        if (this._victoryJumpDelay > 0) {
            this._victoryJumpDelay -= dt;
            return;
        }
        this._victoryJumpTimer += dt * 7.6;
        const groundY = DefChestArenaBounds.instance ? DefChestArenaBounds.instance.groundY : 0.32;
        const bounceSin = Math.abs(Math.sin(this._victoryJumpTimer));
        const jumpHeight = 0.62;

        this.node.getWorldPosition(_tmpEnemyJumpPos);
        _tmpEnemyJumpPos.y = groundY + bounceSin * jumpHeight;
        this.node.setWorldPosition(_tmpEnemyJumpPos);

        const stretchY = 1.0 + (bounceSin - 0.35) * 0.14;
        const squashXZ = 1.0 - (bounceSin - 0.35) * 0.07;
        this.node.setScale(
            this._victoryBaseScale.x * squashXZ,
            this._victoryBaseScale.y * stretchY,
            this._victoryBaseScale.z * squashXZ
        );
    }

    protected lateUpdate(): void {
        if (this.rootBone && this.rootBone.isValid) {
            const p = this.rootBone.position;
            if (p.x !== 0 || p.z !== 0) {
                this.rootBone.setPosition(0, p.y, 0);
            }
        }
    }
}
