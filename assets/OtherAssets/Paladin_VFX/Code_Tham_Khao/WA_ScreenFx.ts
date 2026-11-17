import { _decorator, Canvas, Color, Component, director, Graphics, Node, tween, Tween, UITransform, Vec3 } from 'cc';

const { ccclass, executionOrder } = _decorator;

/**
 * Rung camera kiểu "trauma": shake(độ mạnh) cộng dồn, tự giảm dần.
 * Chạy sau camera follow (executionOrder lớn) và gỡ độ lệch cũ ở update() trước khi follow tính vị trí,
 * nên camera không bị trôi.
 */
@ccclass('WA_CameraShake')
@executionOrder(1000)
export class WA_CameraShake extends Component {
    public static instance: WA_CameraShake = null;

    /** Biên độ tối đa (m) khi trauma = 1. */
    public maxOffset: number = 0.55;

    /** Trauma giảm bao nhiêu mỗi giây. */
    public decay: number = 1.6;

    private _trauma: number = 0;
    private _applied: Vec3 = new Vec3();
    private _t: number = 0;

    public static of(cameraNode: Node): WA_CameraShake {
        if (!cameraNode || !cameraNode.isValid) return null;
        return cameraNode.getComponent(WA_CameraShake) || cameraNode.addComponent(WA_CameraShake);
    }

    /** Rung với độ mạnh 0..1 (cộng dồn, kẹp ở 1). */
    public static shake(amount: number) {
        const s = WA_CameraShake.instance;
        if (!s || !s.isValid) return;
        s._trauma = Math.min(1, s._trauma + amount);
    }

    onLoad() {
        WA_CameraShake.instance = this;
    }

    onDestroy() {
        if (WA_CameraShake.instance === this) WA_CameraShake.instance = null;
    }

    update() {
        // Gỡ độ lệch frame trước để camera follow tính từ vị trí thật.
        if (this._applied.x !== 0 || this._applied.y !== 0 || this._applied.z !== 0) {
            const p = this.node.position;
            this.node.setPosition(p.x - this._applied.x, p.y - this._applied.y, p.z - this._applied.z);
            this._applied.set(0, 0, 0);
        }
    }

    lateUpdate(dt: number) {
        if (this._trauma <= 0) return;
        this._t += dt * 38;
        const k = this._trauma * this._trauma * this.maxOffset;
        // Nhiễu mượt bằng tổng sin lệch pha (đủ cho rung màn hình, không cần perlin).
        this._applied.set(
            k * (Math.sin(this._t * 1.0) * 0.6 + Math.sin(this._t * 2.3 + 1.7) * 0.4),
            k * 0.6 * (Math.sin(this._t * 1.3 + 4.1) * 0.6 + Math.sin(this._t * 2.9 + 0.3) * 0.4),
            k * (Math.sin(this._t * 1.1 + 2.9) * 0.6 + Math.sin(this._t * 2.7 + 5.2) * 0.4),
        );
        const p = this.node.position;
        this.node.setPosition(p.x + this._applied.x, p.y + this._applied.y, p.z + this._applied.z);
        this._trauma = Math.max(0, this._trauma - this.decay * dt);
    }
}

/**
 * Chớp màn hình (lớp phủ màu trên Canvas, mờ dần). Không chặn chạm.
 * Graphics không ăn UIOpacity nên vẽ lại với alpha giảm dần mỗi frame.
 */
export class WA_ScreenFlash {
    private static _node: Node = null;
    private static _g: Graphics = null;
    private static _state = { a: 0 };
    private static _color = new Color();

    public static flash(color: Color, peak: number = 170, duration: number = 0.35) {
        const g = this.ensure();
        if (!g) return;
        this._node.setSiblingIndex(this._node.parent.children.length - 1);
        this._color.set(color);
        const st = this._state;
        Tween.stopAllByTarget(st);
        st.a = Math.max(0, Math.min(255, peak));
        this.draw();
        tween(st)
            .to(Math.max(0.05, duration), { a: 0 }, { easing: 'quadIn', onUpdate: () => this.draw() })
            .call(() => this.draw())
            .start();
    }

    private static draw() {
        const g = this._g;
        if (!g || !g.isValid) return;
        g.clear();
        if (this._state.a <= 0.5) return;
        const c = this._color;
        g.fillColor = new Color(c.r, c.g, c.b, Math.round(this._state.a));
        g.rect(-3000, -3000, 6000, 6000);
        g.fill();
    }

    private static ensure(): Graphics {
        if (this._g && this._g.isValid) return this._g;
        const canvas = director.getScene()?.getComponentInChildren(Canvas);
        if (!canvas) return null;
        const node = new Node('WA_ScreenFlash');
        node.layer = canvas.node.layer;
        node.addComponent(UITransform).setContentSize(6000, 6000);
        this._g = node.addComponent(Graphics);
        node.setParent(canvas.node);
        this._node = node;
        return this._g;
    }
}
