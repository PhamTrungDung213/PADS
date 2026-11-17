import { _decorator, Component, SkeletalAnimation, AnimationClip, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

export enum AnimState {
    Idle = 'idle',
    Run = 'run',
    Attack = 'attack',
    Die = 'die',
    Hit = 'hit',
}

// Bảng ánh xạ mặc định chuẩn bộ 1H Paladin (khớp TestController)
const DEFAULT_1H_CLIPS: Record<AnimState, string> = {
    [AnimState.Idle]: 'paladin_1h_idle',
    [AnimState.Run]: 'paladin_1h_run',
    [AnimState.Attack]: 'paladin_1h_attack',
    [AnimState.Hit]: 'paladin_1h_get_hit',
    [AnimState.Die]: 'paladin_1h_die',
};

const DEFAULT_2H_CLIPS: Record<AnimState, string> = {
    [AnimState.Idle]: 'paladin_2h_idle',
    [AnimState.Run]: 'paladin_2h_run',
    [AnimState.Attack]: 'paladin_2h_attack',
    [AnimState.Hit]: 'paladin_2h_get_hit',
    [AnimState.Die]: 'paladin_2h_die',
};

@ccclass('CharacterAnimation')
export class CharacterAnimation extends Component {
    @property(SkeletalAnimation)
    public skeletalAnim: SkeletalAnimation = null;

    @property({ tooltip: 'Chế độ vũ khí: 1h (1 tay) hoặc 2h (2 tay)' })
    public weaponStance: string = '1h';

    @property({ type: CCFloat, tooltip: 'Tốc độ chạy hoạt ảnh chém kiếm (1.0 = bình thường, 1.5 - 2.0 = chém nhanh dứt khoát)' })
    public attackAnimSpeed: number = 1.6;

    // Bản đồ lưu tên clip thực tế sau khi quét
    private _clipMap: Map<AnimState, string> = new Map();
    private _currentState: AnimState = null;
    private _isLocked: boolean = false;

    onLoad() {
        if (!this.skeletalAnim) {
            this.skeletalAnim = this.getComponent(SkeletalAnimation) || this.getComponentInChildren(SkeletalAnimation);
        }

        // 1. Nạp trước bảng clip chuẩn theo weaponStance (1H hoặc 2H)
        const defaultClips = this.weaponStance === '2h' ? DEFAULT_2H_CLIPS : DEFAULT_1H_CLIPS;
        for (const state of Object.keys(defaultClips)) {
            const s = state as AnimState;
            this._clipMap.set(s, defaultClips[s]);
        }

        // 2. Quét động các clip có trên model để khớp chính xác nếu có 2H
        this.autoMapClips();
    }

    start() {
        this.playIdle(true);
    }

    /** Tự động tìm clip trong danh sách Clips của SkeletalAnimation */
    private autoMapClips() {
        if (!this.skeletalAnim || !this.skeletalAnim.clips) return;

        const clips = this.skeletalAnim.clips;
        const prefix = `paladin_${this.weaponStance}_`;

        for (const clip of clips) {
            if (!clip) continue;
            const name = clip.name.toLowerCase();

            if (name.includes(prefix) || name.includes(this.weaponStance)) {
                if (name.includes('idle')) this._clipMap.set(AnimState.Idle, clip.name);
                else if (name.includes('run')) this._clipMap.set(AnimState.Run, clip.name);
                else if (name.includes('attack')) this._clipMap.set(AnimState.Attack, clip.name);
                else if (name.includes('die')) this._clipMap.set(AnimState.Die, clip.name);
                else if (name.includes('hit')) this._clipMap.set(AnimState.Hit, clip.name);
            }
        }
    }

    public isRunning(): boolean {
        return this._currentState === AnimState.Run;
    }

    public isIdle(): boolean {
        return this._currentState === AnimState.Idle;
    }

    /** Đứng yên */
    public playIdle(force: boolean = false) {
        if (force) this._isLocked = false;
        if (this._isLocked) return;
        if (this._currentState === AnimState.Idle) return;
        this.play(AnimState.Idle, force);
    }

    /** Chạy */
    public playRun(force: boolean = false) {
        if (force) this._isLocked = false;
        if (this._isLocked) return;
        if (this._currentState === AnimState.Run) return;
        this.play(AnimState.Run, force);
    }

    /** Tấn công (Khóa di chuyển và các hành động khác cho đến khi đánh xong) */
    public playAttack(onFinished?: () => void) {
        this.play(AnimState.Attack, false, onFinished);
    }

    /** Chết */
    public playDie() {
        this._isLocked = true;
        this.play(AnimState.Die, true);
    }

    /** Bị trúng đòn */
    public playHit() {
        if (this._isLocked) return;
        this.play(AnimState.Hit, false);
    }

    /** Kiểm tra xem nhân vật có đang bận thực hiện hoạt ảnh khóa (như đánh) không */
    public isBusy(): boolean {
        return this._isLocked;
    }

    /**
     * Phát animation tổng quát
     */
    public play(state: AnimState, force: boolean = false, onFinished?: () => void) {
        if (this._isLocked && !force) return;
        if (this._currentState === state && !this._isLocked) return;

        const clipName = this._clipMap.get(state);
        if (!clipName || !this.skeletalAnim) {
            return;
        }

        this._currentState = state;

        if (state === AnimState.Attack) {
            // Khóa toàn bộ hành động khác trong suốt thời gian ra đòn
            this._isLocked = true;
            this.playOnce(clipName, () => {
                this._isLocked = false;
                this._currentState = AnimState.Idle;
                this.playIdle(true);
                if (onFinished) onFinished();
            });
        } else if (state === AnimState.Die) {
            this._isLocked = true;
            this.playOnce(clipName);
        } else if (state === AnimState.Hit) {
            this._isLocked = true;
            this.playOnce(clipName, () => {
                this._isLocked = false;
                this._currentState = AnimState.Idle;
                this.playIdle(true);
                if (onFinished) onFinished();
            });
        } else {
            this.skeletalAnim.crossFade(clipName, 0.15);
        }
    }

    /**
     * Phát hoạt ảnh 1 lần: phối hợp cả sự kiện FINISHED của SkeletalAnimation và timeout dự phòng
     */
    private playOnce(clipName: string, onFinished?: () => void) {
        const animState = this.skeletalAnim.getState(clipName);
        if (animState) {
            animState.wrapMode = AnimationClip.WrapMode.Normal;
            animState.repeatCount = 1;
            animState.speed = this.attackAnimSpeed;
        }

        this.skeletalAnim.crossFade(clipName, 0.1);

        const duration = animState && animState.duration > 0 ? (animState.duration / this.attackAnimSpeed) : 0.45;

        let isCompleted = false;
        const completeHandler = () => {
            if (isCompleted) return;
            isCompleted = true;
            if (onFinished) onFinished();
        };

        // Lắng nghe sự kiện FINISHED từ engine
        this.skeletalAnim.once(SkeletalAnimation.EventType.FINISHED, completeHandler);

        // Fallback an toàn phòng khi engine không phát event
        this.scheduleOnce(completeHandler, duration + 0.05);
    }

    public unlock() {
        this._isLocked = false;
    }
}
