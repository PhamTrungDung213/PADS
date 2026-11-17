import { _decorator, Component, SkeletalAnimation, input, Input, EventKeyboard, KeyCode, log, AnimationClip } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SkeletalAnimationTester')
export class SkeletalAnimationTester extends Component {
    public static instance: SkeletalAnimationTester = null;

    @property({ type: SkeletalAnimation, tooltip: 'Kéo SkeletalAnimation vào đây (hoặc để trống tự lấy)' })
    public animComp: SkeletalAnimation | null = null;

    @property({ tooltip: 'Thời gian chuyển tiếp mượt giữa 2 anim (giây)' })
    public crossFadeDuration: number = 0.25;

    private _clipNames: string[] = [];
    private _currentIndex: number = -1;

    onLoad() {
        if (SkeletalAnimationTester.instance === null) {
            SkeletalAnimationTester.instance = this;
        } else {
            this.destroy();
            return;
        }

        if (!this.animComp) {
            this.animComp = this.getComponent(SkeletalAnimation);
        }

        if (!this.animComp) {
            log('[AnimTester] Không tìm thấy SkeletalAnimation component!');
            return;
        }

        // Lấy danh sách tên tất cả các clip có sẵn
        this._clipNames = this.animComp.clips.map(clip => clip.name);
        log(`[AnimTester] Tìm thấy ${this._clipNames.length} clips:`, this._clipNames);
    }

    /**
     * Kích hoạt animation theo index (0 -> N)
     */
    public playAnimationByIndex(target: number | string, playOnce: boolean = true) {
        if (!this.animComp || this._clipNames.length === 0) return;

        let targetClipName: string | null = null;

        // 1. Phân giải tên clip từ number hoặc string
        if (typeof target === 'number') {
            if (target >= 0 && target < this._clipNames.length) {
                targetClipName = this._clipNames[target];
            } else {
                log(`[AnimTester] Index ${target} không hợp lệ!`);
                return;
            }
        } else {
            // Tìm kiếm chuỗi: ưu tiên khớp chính xác, nếu không thì tìm theo tiền tố bắt đầu
            const searchKey = target.trim().toLowerCase();
            targetClipName = this._clipNames.find(name => name.toLowerCase() === searchKey)
                || this._clipNames.find(name => name.toLowerCase().startsWith(searchKey))
                || this._clipNames.find(name => name.toLowerCase().includes(searchKey))
                || null;

            if (!targetClipName) {
                log(`[AnimTester] Không tìm thấy clip nào khớp với từ khóa: "${target}"`);
                return;
            }
        }

        // Cập nhật lại index hiện tại
        this._currentIndex = this._clipNames.indexOf(targetClipName);

        // 2. Thiết lập trạng thái AnimationState
        const state = this.animComp.getState(targetClipName);
        if (state) {
            state.wrapMode = playOnce ? AnimationClip.WrapMode.Normal : AnimationClip.WrapMode.Loop;
            state.repeatCount = playOnce ? 1 : Infinity;
        }

        // 3. Phát animation
        if (this.crossFadeDuration > 0) {
            this.animComp.crossFade(targetClipName, this.crossFadeDuration);
        } else {
            this.animComp.play(targetClipName);
        }

        // 4. (Optional)Bắt sự kiện hoàn thành nếu chạy 1 lần
        if (playOnce) {
            this.animComp.once(SkeletalAnimation.EventType.FINISHED, () => {
                log(`[AnimTester] Clip "${targetClipName}" đã chạy xong 1 lần!`);
            });
        }
    }
}