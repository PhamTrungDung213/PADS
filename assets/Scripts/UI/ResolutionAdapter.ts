import { _decorator, Component, Node, view, ResolutionPolicy, Vec3, Camera, screen, macro, UITransform } from 'cc';
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

    @property({ tooltip: 'Mở tính năng tự động thích ứng màn hình Dọc (1080x1920) & Ngang (1920x1080)' })
    public enableLandscapeAdaptation: boolean = false;

    @property({ tooltip: '[Thích ứng ngang/dọc] Tỉ lệ scale bảng chọn kỹ năng ở màn hình Dọc' })
    public adaptivePortraitSkillScale: number = 1.18;

    @property({ tooltip: '[Thích ứng ngang/dọc] Tỉ lệ scale bảng chọn kỹ năng ở màn hình Ngang' })
    public adaptiveLandscapeSkillScale: number = 0.90;

    @property({ type: Node, tooltip: '[Thích ứng ngang/dọc] Node HUD mục tiêu (UI/TreasureHUD)' })
    public treasureHudNode: Node = null;

    @property({ type: Node, tooltip: '[Thích ứng ngang/dọc] Node Banner cảnh báo Phase (UI/WaveBanner)' })
    public waveBannerNode: Node = null;

    @property({ type: Node, tooltip: '[Thích ứng ngang/dọc] Node cụm điều khiển (UI/Control)' })
    public controlRootNode: Node = null;

    @property({ type: Node, tooltip: '[Thích ứng ngang/dọc] Node Popup Chiến thắng (UI/AD/PopupWin)' })
    public popupWinNode: Node = null;

    @property({ type: Node, tooltip: '[Thích ứng ngang/dọc] Node Popup Thất bại (UI/PopupLose)' })
    public popupLoseNode: Node = null;

    private _isPortrait: boolean = true;
    private _lastWidth: number = 0;
    private _lastHeight: number = 0;
    private _windowResizeHandler: (() => void) | null = null;

    public get isPortrait(): boolean {
        return this.enableLandscapeAdaptation ? this._isPortrait : true;
    }

    onLoad() {
        ResolutionAdapter.instance = this;

        view.on('canvas-resize', this.onResize, this);
        if (screen && typeof screen.on === 'function') {
            screen.on('window-resize', this.onResize, this);
            screen.on('orientation-change', this.onResize, this);
        }
        if (typeof window !== 'undefined') {
            this._windowResizeHandler = () => this.onResize();
            window.addEventListener('resize', this._windowResizeHandler);
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
        if (typeof window !== 'undefined' && this._windowResizeHandler) {
            window.removeEventListener('resize', this._windowResizeHandler);
            this._windowResizeHandler = null;
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

    private resolveOptionalUiNodes() {
        const root = this.node;
        if (!this.treasureHudNode) this.treasureHudNode = root.getChildByName('TreasureHUD');
        if (!this.waveBannerNode) this.waveBannerNode = root.getChildByName('WaveBanner');
        if (!this.controlRootNode) this.controlRootNode = root.getChildByName('Control');
        if (!this.joyStickNode) {
            this.joyStickNode = root.getChildByPath('Control/JoyStick') || root.getChildByName('Joystick');
        }
        if (!this.guideHandNode) {
            this.guideHandNode = root.getChildByPath('Control/GuideHand') || root.getChildByName('GuildHand');
        }
        if (!this.skillPanelNode) this.skillPanelNode = root.getChildByName('SkillSelectPanel');
        if (!this.popupWinNode) this.popupWinNode = root.getChildByPath('AD/PopupWin');
        if (!this.popupLoseNode) this.popupLoseNode = root.getChildByName('PopupLose');
        if (!this.exitButtonNode) this.exitButtonNode = root.getChildByPath('EndPoint/Exit');
    }

    /**
     * Tự động căn chỉnh bố cục theo Portrait / Landscape (nếu bật enableLandscapeAdaptation),
     * hoặc khóa cứng Portrait 1080x1920 cho LCH & Survival khi enableLandscapeAdaptation = false.
     */
    public applyOrientation(force: boolean = false) {
        if (this.enableLandscapeAdaptation) {
            this.resolveOptionalUiNodes();
            const winSize = screen.windowSize;
            const frame = view.getFrameSize();
            this._lastWidth = frame.width;
            this._lastHeight = frame.height;

            const isPortrait = winSize.height >= winSize.width;
            this._isPortrait = isPortrait;

            if (isPortrait) {
                view.setDesignResolutionSize(1080, 1920, ResolutionPolicy.FIXED_WIDTH);
                this.applyAdaptivePortraitLayout();
            } else {
                view.setDesignResolutionSize(1920, 1080, ResolutionPolicy.FIXED_HEIGHT);
                this.applyAdaptiveLandscapeLayout();
            }

            if (this.mainCamera && this.mainCamera.node && this.mainCamera.node.isValid) {
                const comps = this.mainCamera.node.getComponents(Component);
                for (let i = 0; i < comps.length; i++) {
                    const c = comps[i] as any;
                    if (c && typeof c.setOrientationMode === 'function') {
                        c.setOrientationMode(isPortrait);
                    }
                }
            }
            return;
        }

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

    private applyAdaptivePortraitLayout() {
        if (this.treasureHudNode) {
            this.treasureHudNode.setPosition(0, 760, 0);
            this.treasureHudNode.setScale(1, 1, 1);
        }
        if (this.waveBannerNode) {
            this.waveBannerNode.setPosition(0, 260, 0);
            const lblNode = this.waveBannerNode.getChildByName('BannerLabel');
            const ut = lblNode ? lblNode.getComponent(UITransform) : null;
            if (ut) ut.setContentSize(980, 122);
        }
        if (this.controlRootNode) {
            this.controlRootNode.setPosition(0, 0, 0);
            this.controlRootNode.setScale(1, 1, 1);
        }
        if (this.skillPanelNode) {
            const s = this.adaptivePortraitSkillScale > 0 ? this.adaptivePortraitSkillScale : 1.18;
            this.skillPanelNode.setPosition(0, 35, 0);
            this.skillPanelNode.setScale(s, s, 1);
        }
        if (this.popupWinNode) {
            this.popupWinNode.setPosition(0, 0, 0);
            this.popupWinNode.setScale(1, 1, 1);
        }
        if (this.popupLoseNode) {
            this.popupLoseNode.setPosition(0, 0, 0);
            this.popupLoseNode.setScale(1, 1, 1);
        }
        if (this.exitButtonNode) {
            this.exitButtonNode.setPosition(430, 820, 0);
            this.exitButtonNode.setScale(1, 1, 1);
        }
    }

    private applyAdaptiveLandscapeLayout() {
        if (this.treasureHudNode) {
            this.treasureHudNode.setPosition(0, 425, 0);
            this.treasureHudNode.setScale(0.92, 0.92, 1);
        }
        if (this.waveBannerNode) {
            this.waveBannerNode.setPosition(0, 135, 0);
            const lblNode = this.waveBannerNode.getChildByName('BannerLabel');
            const ut = lblNode ? lblNode.getComponent(UITransform) : null;
            if (ut) ut.setContentSize(1680, 122);
        }
        if (this.controlRootNode) {
            this.controlRootNode.setPosition(-540, 190, 0);
            this.controlRootNode.setScale(0.88, 0.88, 1);
        }
        if (this.skillPanelNode) {
            const s = this.adaptiveLandscapeSkillScale > 0 ? this.adaptiveLandscapeSkillScale : 0.90;
            this.skillPanelNode.setPosition(0, 20, 0);
            this.skillPanelNode.setScale(s, s, 1);
        }
        if (this.popupWinNode) {
            this.popupWinNode.setPosition(0, 0, 0);
            this.popupWinNode.setScale(0.82, 0.82, 1);
        }
        if (this.popupLoseNode) {
            this.popupLoseNode.setPosition(0, 0, 0);
            this.popupLoseNode.setScale(0.82, 0.82, 1);
        }
        if (this.exitButtonNode) {
            this.exitButtonNode.setPosition(830, 430, 0);
            this.exitButtonNode.setScale(1, 1, 1);
        }
    }
}
