import { _decorator, Component, SkeletalAnimation, AnimationClip } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('EnemyAnimation')
export class EnemyAnimation extends Component {
    @property({ type: SkeletalAnimation, tooltip: 'SkeletalAnimation trên Skeleton' })
    public skeletalAnim: SkeletalAnimation = null;

    private _runClip: string = '';
    private _attackClip: string = '';
    private _dieClip: string = '';
    private _currentClip: string = '';
    private _isInitialized: boolean = false;

    onLoad() {
        this.ensureInitialized();
    }

    private ensureInitialized() {
        if (this._isInitialized && this.skeletalAnim) return;

        if (!this.skeletalAnim) {
            this.skeletalAnim = this.getComponent(SkeletalAnimation) || this.getComponentInChildren(SkeletalAnimation);
        }
        this.scanClips();
        this._isInitialized = true;
    }

    private scanClips() {
        if (!this.skeletalAnim || !this.skeletalAnim.clips) return;

        for (const clip of this.skeletalAnim.clips) {
            if (!clip) continue;
            const name = clip.name.toLowerCase();
            if (name.includes('run') || name.includes('walk')) {
                this._runClip = clip.name;
            } else if (name.includes('attack')) {
                this._attackClip = clip.name;
            } else if (name.includes('die')) {
                this._dieClip = clip.name;
            }
        }

        // Fallback sang defaultClip nếu chưa tìm thấy runClip
        if (!this._runClip && this.skeletalAnim.defaultClip) {
            this._runClip = this.skeletalAnim.defaultClip.name;
        }

        // Fallback nếu không khớp tên
        if (!this._runClip && this.skeletalAnim.clips.length > 0) {
            this._runClip = this.skeletalAnim.clips[0].name;
        }
    }

    public playRun() {
        this.ensureInitialized();
        if (!this.skeletalAnim || !this._runClip) return;

        // BẢO VỆ CỰC KỲ QUAN TRỌNG:
        // Nếu clip run đang phát rồi thì KHÔNG gọi lại crossFade!
        // Nếu gọi crossFade mỗi frame, animation sẽ bị reset về 0 liên tục và bị đơ cứng!
        const state = this.skeletalAnim.getState(this._runClip);
        if (this._currentClip === this._runClip && state && state.isPlaying) {
            return;
        }

        this._currentClip = this._runClip;
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Loop;
        }
        this.skeletalAnim.crossFade(this._runClip, 0.15);
    }

    public playAttack(onFinished?: () => void, animSpeed: number = 1.0) {
        this.ensureInitialized();
        if (!this.skeletalAnim || !this._attackClip) {
            if (onFinished) onFinished();
            return;
        }

        this._currentClip = this._attackClip;
        const state = this.skeletalAnim.getState(this._attackClip);
        const actualSpeed = Math.max(0.1, animSpeed);
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Normal;
            state.repeatCount = 1;
            state.speed = actualSpeed;
            state.setTime(0);
        }
        this.skeletalAnim.crossFade(this._attackClip, 0.1);

        // Thời gian vung đòn thực tế scale theo tốc độ animSpeed
        const baseDuration = 0.45;
        const swingDuration = Math.max(0.12, baseDuration / actualSpeed);
        if (onFinished) {
            this.scheduleOnce(() => {
                if (this._currentClip === this._attackClip) {
                    this._currentClip = '';
                }
                onFinished();
            }, swingDuration);
        }
    }

    public playHit() {
        if (!this.skeletalAnim) return;
        // Nếu có clip hit thì phát ở đây
    }

    public playDie(onFinished?: () => void) {
        this.ensureInitialized();
        if (!this.skeletalAnim || !this._dieClip) {
            if (onFinished) onFinished();
            return;
        }

        this._currentClip = this._dieClip;
        const state = this.skeletalAnim.getState(this._dieClip);
        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Normal;
            state.repeatCount = 1;
        }
        this.skeletalAnim.crossFade(this._dieClip, 0.1);

        const duration = state && state.duration > 0 ? state.duration : 0.6;
        this.scheduleOnce(() => {
            if (onFinished) onFinished();
        }, duration);
    }
}
