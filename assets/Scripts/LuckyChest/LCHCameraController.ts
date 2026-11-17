import { _decorator, Component, Node, Camera, Vec3, tween, Tween, CCFloat, view, ResolutionPolicy, macro } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LCHCameraController')
export class LCHCameraController extends Component {
    public static instance: LCHCameraController = null;

    @property({ type: Camera, tooltip: 'Component Camera trên Main Camera' })
    public camComponent: Camera = null;

    @property({ type: Node, tooltip: 'Node Character_Warrior để follow khi sang Phòng 3' })
    public followTarget: Node = null;

    @property({ tooltip: 'Vị trí cố định 1: Hiển thị trọn Phòng 1 (màn hình dọc)' })
    public camPosRoom1: Vec3 = new Vec3(0, 14.0, -0.2);

    @property({ tooltip: 'Góc xoay Euler cố định 1 (Phòng 1)' })
    public camEulerRoom1: Vec3 = new Vec3(-65, 0, 0);

    @property({ tooltip: 'Vị trí cố định 2: Hiển thị trọn Phòng 2 (màn hình dọc)' })
    public camPosRoom2: Vec3 = new Vec3(0, 14.0, -11.5);

    @property({ tooltip: 'Góc xoay Euler cố định 2 (Phòng 2)' })
    public camEulerRoom2: Vec3 = new Vec3(-65, 0, 0);

    @property({ tooltip: 'Vị trí cố định 3: Lia đến ngắm Rương 3 (Chest2 tại z=-40) khi mới vào Phòng 3' })
    public camPosRoom3Chest: Vec3 = new Vec3(0, 14.0, -33.5);

    @property({ tooltip: 'Góc xoay Euler khi ngắm Rương 3 và Follow Phòng 3' })
    public camEulerRoom3: Vec3 = new Vec3(-65, 0, 0);

    @property({ tooltip: 'Khoảng cách lệch (Offset) khi Camera Follow nhân vật ở Phòng 3' })
    public followOffsetRoom3: Vec3 = new Vec3(0, 14.0, 6.5);

    @property({ type: CCFloat, tooltip: 'Tốc độ bám theo nhân vật ở Phòng 3' })
    public followSmoothSpeed: number = 7.0;

    @property({ type: CCFloat, tooltip: 'FOV chuẩn cho màn hình dọc (Portrait 1080x1920)' })
    public portraitFov: number = 46.0;

    private _isFollowingRoom3: boolean = false;
    private _basePos: Vec3 = new Vec3();
    private _targetPos: Vec3 = new Vec3();
    private _finalPos: Vec3 = new Vec3();
    private _shakeOffset: Vec3 = new Vec3();
    private _shakeTimer: number = 0;
    private _shakeDuration: number = 0;
    private _shakeIntensity: number = 0;

    protected onLoad(): void {
        LCHCameraController.instance = this;
        view.setOrientation(macro.ORIENTATION_PORTRAIT);
        view.setDesignResolutionSize(1080, 1920, ResolutionPolicy.SHOW_ALL);
        this._basePos.set(this.camPosRoom1);
        this.node.setWorldPosition(this._basePos);
        this.node.setRotationFromEuler(this.camEulerRoom1.x, this.camEulerRoom1.y, this.camEulerRoom1.z);
        if (this.camComponent) {
            this.camComponent.fov = this.portraitFov;
        }
    }

    protected onDestroy(): void {
        if (LCHCameraController.instance === this) {
            LCHCameraController.instance = null;
        }
    }

    public snapToRoom1(): void {
        this._isFollowingRoom3 = false;
        Tween.stopAllByTarget(this._basePos);
        this._basePos.set(this.camPosRoom1);
        this.node.setWorldPosition(this._basePos);
        this.node.setRotationFromEuler(this.camEulerRoom1.x, this.camEulerRoom1.y, this.camEulerRoom1.z);
        if (this.camComponent) {
            this.camComponent.fov = this.portraitFov;
        }
    }

    public moveToRoom2(duration: number = 0.75, onDone?: () => void): void {
        this._isFollowingRoom3 = false;
        Tween.stopAllByTarget(this._basePos);
        this.node.setRotationFromEuler(this.camEulerRoom2.x, this.camEulerRoom2.y, this.camEulerRoom2.z);

        tween(this._basePos)
            .to(duration, { x: this.camPosRoom2.x, y: this.camPosRoom2.y, z: this.camPosRoom2.z }, { easing: 'sineInOut' })
            .call(() => {
                if (onDone) onDone();
            })
            .start();
    }

    public panToRoom3ChestThenFollow(panDuration: number = 0.9, holdDuration: number = 0.7, onFollowStarted?: () => void): void {
        this._isFollowingRoom3 = false;
        Tween.stopAllByTarget(this._basePos);
        this.node.setRotationFromEuler(this.camEulerRoom3.x, this.camEulerRoom3.y, this.camEulerRoom3.z);

        tween(this._basePos)
            .to(panDuration, { x: this.camPosRoom3Chest.x, y: this.camPosRoom3Chest.y, z: this.camPosRoom3Chest.z }, { easing: 'sineInOut' })
            .delay(holdDuration)
            .call(() => {
                if (this.followTarget && this.followTarget.isValid) {
                    const heroPos = this.followTarget.worldPosition;
                    const followStart = new Vec3(
                        heroPos.x + this.followOffsetRoom3.x,
                        heroPos.y + this.followOffsetRoom3.y,
                        heroPos.z + this.followOffsetRoom3.z
                    );
                    tween(this._basePos)
                        .to(0.65, { x: followStart.x, y: followStart.y, z: followStart.z }, { easing: 'sineInOut' })
                        .call(() => {
                            this._isFollowingRoom3 = true;
                            if (onFollowStarted) onFollowStarted();
                        })
                        .start();
                } else {
                    this._isFollowingRoom3 = true;
                    if (onFollowStarted) onFollowStarted();
                }
            })
            .start();
    }

    public enableFollowRoom3Immediate(): void {
        Tween.stopAllByTarget(this._basePos);
        this._isFollowingRoom3 = true;
    }

    public shake(duration: number = 0.45, intensity: number = 0.35): void {
        this._shakeDuration = duration;
        this._shakeTimer = duration;
        this._shakeIntensity = intensity;
    }

    protected lateUpdate(dt: number): void {
        if (this._isFollowingRoom3 && this.followTarget && this.followTarget.isValid) {
            this.followTarget.getWorldPosition(this._targetPos);
            this._targetPos.add(this.followOffsetRoom3);
            const t = Math.min(1.0, this.followSmoothSpeed * dt);
            Vec3.lerp(this._basePos, this._basePos, this._targetPos, t);
        }

        if (this._shakeTimer > 0) {
            this._shakeTimer -= dt;
            const progress = Math.max(0, this._shakeTimer / Math.max(0.01, this._shakeDuration));
            const amp = this._shakeIntensity * progress;
            this._shakeOffset.set(
                (Math.random() * 2 - 1) * amp,
                (Math.random() * 2 - 1) * amp * 0.6,
                (Math.random() * 2 - 1) * amp
            );
        } else {
            this._shakeOffset.set(0, 0, 0);
        }

        Vec3.add(this._finalPos, this._basePos, this._shakeOffset);
        this.node.setWorldPosition(this._finalPos);
    }
}
