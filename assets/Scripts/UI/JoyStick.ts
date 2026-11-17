import { _decorator, Component, Node, EventTouch, EventMouse, Vec2, Vec3, UITransform, CCFloat, input, Input } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';
import { GuideHand } from './GuideHand';
import { GameManager } from '../System/GameManager';

const { ccclass, property } = _decorator;

@ccclass('JoyStick')
export class JoyStick extends Component {
    public static instance: JoyStick | null = null;

    @property({ type: Node, tooltip: 'Node vòng tròn Joystick (AllAxis_Outline / Ring)' })
    public ringNode: Node = null;

    @property({ type: Node, tooltip: 'Node chấm tròn di chuyển (Handle_Plain / Dot)' })
    public dotNode: Node = null;

    @property({ type: Node, tooltip: 'Node bàn tay hướng dẫn' })
    public guideHandNode: Node = null;

    @property({ type: CCFloat, tooltip: 'Bán kính kéo tối đa của núm Handle (pixel)' })
    public maxRadius: number = 80.0;

    @property({ type: CCFloat, tooltip: 'Vùng chết tối thiểu để nhận di chuyển (pixel)' })
    public deadZone: number = 10.0;

    // Vector hướng 2D gửi ra ngoài
    public inputDir: Vec2 = new Vec2(0, 0);

    private _uiTransform: UITransform = null;
    private _startPos: Vec2 = new Vec2();
    private _isHolding: boolean = false;
    private _isDisabled: boolean = false;
    public isInputLocked: boolean = false;

    public get isHolding(): boolean {
        return this._isHolding && !this.isInputLocked && !this._isDisabled;
    }

    public setInputLocked(locked: boolean) {
        this.isInputLocked = locked;
        if (locked && this._isHolding) {
            this.onTouchEnd();
        }
    }

    onLoad() {
        JoyStick.instance = this;
        this._isDisabled = false;

        // Đảm bảo node cha (Control) và chính JoyStick luôn active
        if (this.node.parent && !this.node.parent.active) {
            this.node.parent.active = true;
        }
        this.node.active = true;

        this._uiTransform = this.getComponent(UITransform) || this.addComponent(UITransform);

        if (!this.ringNode) {
            this.ringNode = this.node.getChildByName('AllAxis_Outline')
                || this.node.getChildByName('Ring');
        }
        if (!this.dotNode) {
            this.dotNode = this.node.getChildByName('Handle_Plain')
                || this.node.getChildByName('Dot')
                || this.node.getChildByName('Knob');
        }
        if (!this.guideHandNode) {
            this.guideHandNode = this.node.parent?.getChildByName('GuideHand')
                || this.node.scene?.getChildByPath('UI/Control/GuideHand');
        }

        // Ẩn cả vòng viền và núm kéo khi vừa vào game (tham khảo JoyStick.ts trong Test)
        this._setVisible(false);

        // Lắng nghe sự kiện chạm vuốt trên toàn màn hình (Mobile)
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        // Lắng nghe sự kiện chuột (Desktop preview)
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);

        // Lắng nghe sự kiện kết thúc game để tắt hẳn Joystick
        EventManager.instance.on(GameEvent.SCREEN_CLEAR, this.disableJoystick, this);
        EventManager.instance.on(GameEvent.GAME_WIN, this.disableJoystick, this);
        EventManager.instance.on(GameEvent.GAME_OVER, this.disableJoystick, this);
    }

    onDestroy() {
        if (JoyStick.instance === this) {
            JoyStick.instance = null;
        }
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);

        EventManager.instance.off(GameEvent.SCREEN_CLEAR, this.disableJoystick, this);
        EventManager.instance.off(GameEvent.GAME_WIN, this.disableJoystick, this);
        EventManager.instance.off(GameEvent.GAME_OVER, this.disableJoystick, this);
    }

    /** Tắt vĩnh viễn Joystick khi kết thúc màn chơi */
    public disableJoystick() {
        this._isDisabled = true;
        this._isHolding = false;
        this.inputDir.set(0, 0);
        this._setVisible(false);
        this.node.active = false;
        if (this.node.parent && this.node.parent.name === 'Control') {
            this.node.parent.active = false;
        }
    }

    private onMouseDown(event: EventMouse) {
        if (event.getButton() !== EventMouse.BUTTON_LEFT) return;
        this.handleStart(event.getUILocation());
    }

    private onMouseMove(event: EventMouse) {
        if (!this._isHolding) return;
        this.handleMove(event.getUILocation());
    }

    private onMouseUp(event: EventMouse) {
        if (!this._isHolding) return;
        this.onTouchEnd();
    }

    private onTouchStart(event: EventTouch) {
        this.handleStart(event.getUILocation());
    }

    private onTouchMove(event: EventTouch) {
        this.handleMove(event.getUILocation());
    }

    private handleStart(touchPos: Vec2) {
        if (this._isDisabled || this.isInputLocked || !this.node.activeInHierarchy) return;
        if (GameManager.instance && GameManager.instance.isPaused) return;

        this._isHolding = true;

        const localPos = this._uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));

        // Lưu tâm chạm ban đầu
        this._startPos.set(localPos.x, localPos.y);

        // Đặt cả vòng viền và núm kéo vào đúng điểm chạm
        if (this.ringNode) this.ringNode.setPosition(localPos.x, localPos.y, 0);
        if (this.dotNode) this.dotNode.setPosition(localPos.x, localPos.y, 0);

        // Hiển thị cụm Joystick lên
        this._setVisible(true);

        this.inputDir.set(0, 0);

        // Ẩn bàn tay hướng dẫn vuốt
        if (this.guideHandNode) {
            const gh = this.guideHandNode.getComponent(GuideHand);
            if (gh) {
                gh.onUserTouchStart();
            } else {
                this.guideHandNode.active = false;
            }
        }
    }

    private handleMove(touchPos: Vec2) {
        if (this._isDisabled || this.isInputLocked || !this._isHolding || !this.node.activeInHierarchy) return;
        if (GameManager.instance && GameManager.instance.isPaused) {
            this.onTouchEnd();
            return;
        }

        const localPos = this._uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));

        // Khoảng cách từ ngón tay đến tâm điểm chạm ban đầu
        const deltaX = localPos.x - this._startPos.x;
        const deltaY = localPos.y - this._startPos.y;

        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Nằm trong vùng chết -> đứng yên tại tâm
        if (dist < this.deadZone) {
            if (this.dotNode) this.dotNode.setPosition(this._startPos.x, this._startPos.y, 0);
            this.inputDir.set(0, 0);
            EventManager.instance.emit(GameEvent.JOYSTICK_STOP);
            return;
        }

        const nx = deltaX / dist;
        const ny = deltaY / dist;
        const clampedDist = Math.min(dist, this.maxRadius);

        // Di chuyển Handle quanh tâm Outline
        if (this.dotNode) {
            this.dotNode.setPosition(
                this._startPos.x + nx * clampedDist,
                this._startPos.y + ny * clampedDist,
                0,
            );
        }

        // Lưu vector hướng
        this.inputDir.set(nx, ny);

        // Gửi sự kiện di chuyển cho Hero
        EventManager.instance.emit(GameEvent.JOYSTICK_MOVE, {
            x: nx,
            y: ny,
        });
    }

    /**
     * 3. Khi buông tay: Ẩn Joystick và dừng nhân vật
     */
    private onTouchEnd(event?: EventTouch) {
        if (!this._isHolding) return;
        this._isHolding = false;

        // Ẩn cụm Joystick đi khi buông tay
        this._setVisible(false);
        this.inputDir.set(0, 0);

        if (this.guideHandNode) {
            const gh = this.guideHandNode.getComponent(GuideHand);
            if (gh) {
                gh.onUserTouchEnd();
            }
        }

        EventManager.instance.emit(GameEvent.JOYSTICK_STOP);
    }

    private _setVisible(visible: boolean) {
        if (this.ringNode) this.ringNode.active = visible;
        if (this.dotNode) this.dotNode.active = visible;
    }
}
