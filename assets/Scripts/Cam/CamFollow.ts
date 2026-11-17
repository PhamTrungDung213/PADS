import { _decorator, Component, Node, Vec3, CCFloat, Camera, view } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {
    public static instance: CameraFollow = null;

    @property({ type: Node, tooltip: 'Node mục tiêu camera bám theo (Player)' })
    public target: Node = null!;

    @property({ tooltip: 'Khoảng cách lệch (Offset) chuẩn so với mục tiêu (Mặc định 0, 10, 12 theo Inspector)' })
    public offset: Vec3 = new Vec3(0, 10, 12);

    @property({ type: CCFloat, tooltip: 'Tốc độ bám theo (càng lớn bám càng nhanh, 5 - 15 là hợp lý)' })
    public smoothSpeed: number = 8.0;

    // ==========================================
    // GIẢI PHÁP 3: THÍCH ỨNG CAMERA THEO TỶ LỆ MÀN HÌNH
    // ==========================================
    @property({ type: Camera, tooltip: 'Component Camera để tự động chỉnh FOV' })
    public camComponent: Camera = null;

    @property({ type: CCFloat, tooltip: 'FOV mặc định cho màn hình Ngang / iPad (45 độ)' })
    public defaultFov: number = 45.0;

    @property({ type: CCFloat, tooltip: 'FOV mở rộng cho màn hình Dọc hẹp (50-52 độ để thấy đủ 4 lối đi quái)' })
    public portraitFov: number = 52.0;

    private _targetPos: Vec3 = new Vec3();
    private _currentPos: Vec3 = new Vec3();
    private _activeOffset: Vec3 = new Vec3();

    // Rung màn hình (Screen Shake)
    private _shakeTimer: number = 0;
    private _shakeDuration: number = 0;
    private _shakeIntensity: number = 0.35;
    private _shakeOffset: Vec3 = new Vec3();

    onLoad() {
        CameraFollow.instance = this;
        if (!this.camComponent) {
            this.camComponent = this.getComponent(Camera);
        }
        this._activeOffset.set(this.offset);

        // Bắt sự kiện thay đổi kích thước khung nhìn
        view.on('canvas-resize', this.adaptCameraToScreen, this);
    }

    onDestroy() {
        if (CameraFollow.instance === this) {
            CameraFollow.instance = null;
        }
        view.off('canvas-resize', this.adaptCameraToScreen, this);
    }

    start() {
        if (!this.target) {
            this.target = this.node.scene?.getChildByName('Character');
        }
        if (!this.camComponent) {
            this.camComponent = this.getComponent(Camera);
        }

        this.adaptCameraToScreen();

        if (this.target) {
            this.target.getWorldPosition(this._targetPos);
            this._targetPos.add(this._activeOffset);
            this.node.setWorldPosition(this._targetPos);
        }
    }

    /**
     * Kích hoạt hiệu ứng rung màn hình khi tung chiêu tối thượng
     */
    public shake(duration: number = 0.6, intensity: number = 0.4) {
        this._shakeDuration = duration;
        this._shakeTimer = duration;
        this._shakeIntensity = intensity;
    }

    /**
     * Tự động điều chỉnh góc nhìn FOV và độ cao Camera tùy theo tỷ lệ màn hình
     */
    public adaptCameraToScreen() {
        const visibleSize = view.getVisibleSize();
        if (visibleSize.height <= 0) return;

        const aspect = visibleSize.width / visibleSize.height;

        if (aspect < 0.65) {
            // Màn hình dọc hẹp (Điện thoại 9:16 hoặc 9:20)
            // Nới rộng góc nhìn FOV để thấy rõ cả 4 nhánh đường đất và 20-30 quái
            if (this.camComponent) {
                this.camComponent.fov = this.portraitFov;
            }
            this._activeOffset.set(this.offset.x, this.offset.y + 1.5, this.offset.z + 1.0);
        } else {
            // Màn hình vuông / iPad (4:3) hoặc màn hình Ngang (16:9)
            // Giữ chuẩn FOV 45 độ và góc nhìn cận cảnh
            if (this.camComponent) {
                this.camComponent.fov = this.defaultFov;
            }
            this._activeOffset.set(this.offset);
        }
    }

    lateUpdate(deltaTime: number) {
        if (!this.target) {
            this.target = this.node.scene?.getChildByName('Character');
            if (!this.target) return;
        }

        this.target.getWorldPosition(this._targetPos);
        this._targetPos.add(this._activeOffset);

        this.node.getWorldPosition(this._currentPos);
        const t = Math.min(1.0, this.smoothSpeed * deltaTime);
        Vec3.lerp(this._currentPos, this._currentPos, this._targetPos, t);

        // Xử lý rung camera
        if (this._shakeTimer > 0) {
            this._shakeTimer -= deltaTime;
            const progress = Math.max(0, this._shakeTimer / this._shakeDuration);
            const currentAmp = this._shakeIntensity * progress;
            this._shakeOffset.set(
                (Math.random() * 2 - 1) * currentAmp,
                (Math.random() * 2 - 1) * currentAmp * 0.6,
                (Math.random() * 2 - 1) * currentAmp,
            );
            this._currentPos.add(this._shakeOffset);
        }

        this.node.setWorldPosition(this._currentPos);
    }
}
