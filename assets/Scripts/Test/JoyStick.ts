import { _decorator, Component, Node, EventTouch, Vec2, Vec3, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Joystick')
export class Joystick extends Component {
    public static instance: Joystick | null = null;

    @property({ type: Node, tooltip: 'Kéo Node AllAxis_Outline vào đây' })
    public outlineNode: Node = null!;

    @property({ type: Node, tooltip: 'Kéo Node Handle_Plain vào đây' })
    public handleNode: Node = null!;

    @property({ tooltip: 'Bán kính kéo tối đa của núm Handle (pixel)' })
    public maxRadius: number = 80;

    @property({ tooltip: 'Vùng chết tối thiểu để nhận di chuyển' })
    public deadZone: number = 10;

    // Vector hướng gửi sang TestController
    public inputDir: Vec2 = new Vec2(0, 0);

    private _uiTransform: UITransform = null!;
    private _startPos: Vec2 = new Vec2();

    onLoad() {
        Joystick.instance = this;
        this._uiTransform = this.getComponent(UITransform)!;

        // Ẩn cả vòng viền và núm kéo khi vừa vào game
        this._setVisible(false);

        // Đăng ký sự kiện chạm vuốt trên toàn bộ vùng của Node JoyStick
        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    onDestroy() {
        if (Joystick.instance === this) {
            Joystick.instance = null;
        }
        this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    /**
     * 1. Khi vừa chạm ngón tay: Hiện Joystick ngay tại tọa độ chạm
     */
    private _onTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        // Đổi tọa độ màn hình sang tọa độ local của JoyStick
        const localPos = this._uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));

        // Lưu tâm chạm ban đầu
        this._startPos.set(localPos.x, localPos.y);

        // Đặt cả vòng tròn viền và núm kéo vào đúng điểm chạm
        if (this.outlineNode) this.outlineNode.setPosition(localPos.x, localPos.y, 0);
        if (this.handleNode) this.handleNode.setPosition(localPos.x, localPos.y, 0);

        // Hiện thị cụm Joystick lên
        this._setVisible(true);

        this.inputDir.set(0, 0);
    }

    /**
     * 2. Khi vuốt kéo: Núm lệch quanh tâm viền với bán kính maxRadius
     */
    private _onTouchMove(event: EventTouch) {
        const touchPos = event.getUILocation();
        const localPos = this._uiTransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));

        // Khoảng cách từ ngón tay đến tâm điểm chạm ban đầu
        const deltaX = localPos.x - this._startPos.x;
        const deltaY = localPos.y - this._startPos.y;

        const touchVec = new Vec2(deltaX, deltaY);
        const dist = touchVec.length();

        // Nằm trong vùng chết -> đứng yên tại tâm
        if (dist < this.deadZone) {
            if (this.handleNode) this.handleNode.setPosition(this._startPos.x, this._startPos.y, 0);
            this.inputDir.set(0, 0);
            return;
        }

        const dir = touchVec.normalize();
        const clampedDist = Math.min(dist, this.maxRadius);

        // Di chuyển Handle quanh tâm Outline
        if (this.handleNode) {
            this.handleNode.setPosition(
                this._startPos.x + dir.x * clampedDist,
                this._startPos.y + dir.y * clampedDist,
                0
            );
        }

        // Truyền vector hướng cho nhân vật chạy
        this.inputDir.set(dir.x, dir.y);
    }

    /**
     * 3. Khi buông tay: Ẩn Joystick và dừng nhân vật
     */
    private _onTouchEnd() {
        this._setVisible(false);
        this.inputDir.set(0, 0);
    }

    private _setVisible(visible: boolean) {
        if (this.outlineNode) this.outlineNode.active = visible;
        if (this.handleNode) this.handleNode.active = visible;
    }
}