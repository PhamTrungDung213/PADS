import { _decorator, Component, Node, Vec3, tween, CCFloat, Animation } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

@ccclass('GuildHand')
export class GuideHand extends Component {
    @property({ type: CCFloat, tooltip: 'Idle duration without player input before re-showing tutorial hand (seconds)' })
    public idleTimeout: number = 2.5;

    @property({ type: Node, tooltip: 'Node containing hand image and guide to show/hide' })
    public handIcon: Node = null;

    private _idleTimer: number = 0;
    private _isInteracting: boolean = false;
    private _isBlocked: boolean = false; // Khóa bàn tay khi mở popup chọn skill hoặc khi game kết thúc
    private _initialPos: Vec3 = new Vec3();
    private _tweenAnim: any = null;
    private _animComp: Animation = null;

    onLoad() {
        if (!this.handIcon) {
            this.handIcon = this.node.getChildByName('animGuide') || this.node;
        }

        if (this.handIcon) {
            this.handIcon.getPosition(this._initialPos);
            this._animComp = this.handIcon.getComponent(Animation) || this.handIcon.getComponentInChildren(Animation);
        }

        // Lắng nghe sự kiện joystick để tự động ẩn/hiện bàn tay nhắc nhở
        EventManager.instance.on(GameEvent.JOYSTICK_MOVE, this.onUserTouchStart, this);
        EventManager.instance.on(GameEvent.JOYSTICK_STOP, this.onUserTouchEnd, this);

        // Lắng nghe sự kiện chọn kỹ năng và kết thúc game để ẩn triệt để bàn tay
        EventManager.instance.on(GameEvent.LEVEL_UP, this.onSkillPopupOpen, this);
        EventManager.instance.on(GameEvent.SKILL_SELECTED, this.onSkillPopupClose, this);
        EventManager.instance.on(GameEvent.SCREEN_CLEAR, this.onGameEnd, this);
        EventManager.instance.on(GameEvent.GAME_WIN, this.onGameEnd, this);
        EventManager.instance.on(GameEvent.GAME_OVER, this.onGameEnd, this);
    }

    onDestroy() {
        EventManager.instance.off(GameEvent.JOYSTICK_MOVE, this.onUserTouchStart, this);
        EventManager.instance.off(GameEvent.JOYSTICK_STOP, this.onUserTouchEnd, this);
        EventManager.instance.off(GameEvent.LEVEL_UP, this.onSkillPopupOpen, this);
        EventManager.instance.off(GameEvent.SKILL_SELECTED, this.onSkillPopupClose, this);
        EventManager.instance.off(GameEvent.SCREEN_CLEAR, this.onGameEnd, this);
        EventManager.instance.off(GameEvent.GAME_WIN, this.onGameEnd, this);
        EventManager.instance.off(GameEvent.GAME_OVER, this.onGameEnd, this);
        this.stopSwipeTween();
    }

    start() {
        this.show();
    }

    public onSkillPopupOpen() {
        this._isBlocked = true;
        this._idleTimer = 0;
        this.hide();
    }

    public onSkillPopupClose() {
        this._isBlocked = false;
        this._idleTimer = 0;
    }

    public onGameEnd() {
        this._isBlocked = true;
        this._idleTimer = 0;
        this.hide();
    }

    public show() {
        // Nếu đang bị chặn (khi mở bảng skill hoặc khi kết thúc game), tuyệt đối không hiện
        if (this._isBlocked) return;

        if (this.handIcon && this.handIcon !== this.node) {
            this.handIcon.active = true;
        } else {
            for (const child of this.node.children) {
                child.active = true;
            }
        }

        if (this._animComp) {
            this._animComp.play();
        } else {
            this.startSwipeTween();
        }
    }

    public hide() {
        if (this._animComp) {
            this._animComp.stop();
        }
        this.stopSwipeTween();

        // TUYỆT ĐỐI KHÔNG tắt this.node.active vì sẽ ngắt hàm update() đo 2.5s idle
        if (this.handIcon && this.handIcon !== this.node) {
            this.handIcon.active = false;
        } else {
            for (const child of this.node.children) {
                child.active = false;
            }
        }
    }

    public onUserTouchStart() {
        this._isInteracting = true;
        this._idleTimer = 0;
        this.hide();
    }

    public onUserTouchEnd() {
        this._isInteracting = false;
        this._idleTimer = 0;
    }

    private isContentVisible(): boolean {
        if (this.handIcon && this.handIcon !== this.node) {
            return this.handIcon.active;
        }
        return this.node.children.length > 0 && this.node.children[0].active;
    }

    update(deltaTime: number) {
        // Đang bị chặn (khi hiện skill popup hoặc kết thúc game), không bao giờ đếm hoặc hiện
        if (this._isBlocked) return;

        // Đang thao tác kéo joystick hoặc bàn tay đang hiển thị thì không đếm
        if (this._isInteracting) return;
        if (this.isContentVisible()) return;

        this._idleTimer += deltaTime;
        if (this._idleTimer >= this.idleTimeout) {
            this._idleTimer = 0;
            this.show();
        }
    }

    private startSwipeTween() {
        this.stopSwipeTween();
        if (!this.handIcon) return;

        this.handIcon.setPosition(this._initialPos);

        // Tween bàn tay vuốt qua vuốt lại mô phỏng thao tác kéo cần điều khiển
        this._tweenAnim = tween(this.handIcon)
            .to(0.6, { position: new Vec3(this._initialPos.x + 80, this._initialPos.y + 60, 0) }, { easing: 'sineInOut' })
            .to(0.6, { position: new Vec3(this._initialPos.x - 80, this._initialPos.y - 60, 0) }, { easing: 'sineInOut' })
            .to(0.6, { position: this._initialPos }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private stopSwipeTween() {
        if (this._tweenAnim) {
            this._tweenAnim.stop();
            this._tweenAnim = null;
        }
    }
}
