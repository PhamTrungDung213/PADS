import { _decorator, Component, Node, view, ResolutionPolicy, Vec3, Camera, screen, macro } from 'cc';
import { SkillPopUp } from './SkillPopUp';
import { GuildHandSkill } from './GuildHandSkill';

const { ccclass, property } = _decorator;

/**
 * ResolutionAdapter - Fix cứng giao diện ở màn hình Dọc (Portrait 1080x1920)
 */
@ccclass('ResolutionAdapter')
export class ResolutionAdapter extends Component {
    public static instance: ResolutionAdapter | null = null;

    @property({ type: Node, tooltip: 'Node chứa danh sách thẻ bài (SkillSelectPanel)' })
    public skillPanelNode: Node = null;

    @property({ type: Node, tooltip: 'Node điều khiển Joystick (UI/Control/JoyStick)' })
    public joyStickNode: Node = null;

    @property({ type: Node, tooltip: 'Node bàn tay hướng dẫn di chuyển (UI/Control/GuideHand)' })
    public guideHandNode: Node = null;

    @property({ type: Node, tooltip: 'Nút thoát / CTA (UI/EndPoint/Exit)' })
    public exitButtonNode: Node = null;

    @property({ type: Camera, tooltip: 'Main Camera 3D' })
    public mainCamera: Camera = null;

    @property({ tooltip: 'Tỉ lệ scale của màn hình chọn kỹ năng ở màn hình dọc (Portrait)' })
    public portraitSkillPanelScale: number = 1.5;

    private _isPortrait: boolean = true;
    private _lastWidth: number = 0;
    private _lastHeight: number = 0;

    public get isPortrait(): boolean {
        return true;
    }

    onLoad() {
        ResolutionAdapter.instance = this;

        view.on('canvas-resize', this.onResize, this);
        if (screen && typeof screen.on === 'function') {
            screen.on('window-resize', this.onResize, this);
            screen.on('orientation-change', this.onResize, this);
        }

        this.applyOrientation(true);
    }

    onDestroy() {
        if (ResolutionAdapter.instance === this) {
            ResolutionAdapter.instance = null;
        }
        view.off('canvas-resize', this.onResize, this);
        if (screen && typeof screen.off === 'function') {
            screen.off('window-resize', this.onResize, this);
            screen.off('orientation-change', this.onResize, this);
        }
    }

    update(dt: number) {
        const frame = view.getFrameSize();
        if (frame.width !== this._lastWidth || frame.height !== this._lastHeight) {
            this.onResize();
        }
    }

    private onResize() {
        this.applyOrientation(false);
    }

    /**
     * Khóa cứng bố cục ở màn hình dọc 1080x1920 (Portrait)
     */
    public applyOrientation(force: boolean = false) {
        const frame = view.getFrameSize();
        this._lastWidth = frame.width;
        this._lastHeight = frame.height;
        this._isPortrait = true;

        view.setOrientation(macro.ORIENTATION_PORTRAIT);
        view.setDesignResolutionSize(1080, 1920, ResolutionPolicy.SHOW_ALL);

        const halfW = 1080 * 0.5;
        const halfH = 1920 * 0.5;

        // 1. Bố cục 3 thẻ bài
        if (this.skillPanelNode && this.skillPanelNode.isValid) {
            const s = this.portraitSkillPanelScale || 1.18;
            this.skillPanelNode.setScale(new Vec3(s, s, 1));
            this.skillPanelNode.setPosition(0, 45, 0);
        }

        // 2. Nút Exit: Neo ở góc trên - phải màn hình 1080x1920
        if (this.exitButtonNode && this.exitButtonNode.isValid) {
            const exitX = Math.max(300, halfW - 80);
            const exitY = Math.max(200, halfH - 90);
            this.exitButtonNode.setPosition(exitX, exitY, 0);
        }

        // 3. Joystick & GuideHand: Đặt ở 32% từ đáy màn hình lên (y = -528 trên khung 1080x1920)
        const joyY = -halfH * 0.55;
        if (this.joyStickNode && this.joyStickNode.isValid) {
            this.joyStickNode.setPosition(0, joyY, 0);
        }
        if (this.guideHandNode && this.guideHandNode.isValid) {
            this.guideHandNode.setPosition(0, joyY - 58.5, 0);
        }

        // 4. Camera 3D: Chỉ đặt FOV 60 nếu không có LCHCameraController quản lý riêng
        if (this.mainCamera && this.mainCamera.isValid) {
            const hasLchCam = this.mainCamera.node.getComponent('LCHCameraController');
            if (!hasLchCam) {
                this.mainCamera.fov = 60;
            }
        }

        const root = this.node.scene || this.node;
        const skillPopup = root.getComponentInChildren(SkillPopUp);
        if (skillPopup && skillPopup.node.active) {
            const hand = skillPopup.getComponentInChildren(GuildHandSkill);
            if (hand && hand.node.active) {
                const activeNodes = skillPopup.cards.filter((c) => c.node.active).map((c) => c.node);
                if (activeNodes.length > 0) {
                    hand.pointToCards(activeNodes, activeNodes.length === 1);
                }
            }
        }
    }
}
