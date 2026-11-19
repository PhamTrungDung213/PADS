import {
    _decorator,
    Component,
    Node,
    CCFloat,
    Button,
    UITransform,
    view,
    input,
    Input,
    EventTouch,
    director,
    Color,
    Graphics,
    Label,
    Prefab,
    Sprite,
    SpriteFrame,
    Vec3,
    tween,
    Tween,
    instantiate,
    assetManager,
    js,
} from 'cc';
import PlayableAdsController from '../ADS/PlayableAdsController';
import { EventManager, GameEvent } from '../System/EventManager';
import { AudioManager } from '../System/AudioManager';
import { WinPopCtrl } from './WinPopCtrl';

const { ccclass, property } = _decorator;

const GAME_LOGO_UUID = 'e87ded3e-6020-47c1-84a8-0886bc5c6006@f9941';

@ccclass('ADCtrl')
export class ADCtrl extends Component {
    public static instance: ADCtrl | null = null;

    @property({ type: Node, tooltip: 'Node containing the exit button after 5 seconds (EndPoint)' })
    public endPointNode: Node = null;

    @property({ type: Node, tooltip: 'Victory popup node (PopupWin)' })
    public popupWinNode: Node = null;

    @property({ type: Node, tooltip: 'Defeat popup node (UI/PopupLose)' })
    public popupLoseNode: Node = null;

    @property({ type: Prefab, tooltip: 'Prefab Failed.prefab dùng cho màn hình Thua (nếu PopupLose chưa có sẵn)' })
    public failedPrefab: Prefab = null;

    @property({ type: SpriteFrame, tooltip: 'Logo game (assets/icon.png) gắn cho PopupLose' })
    public gameLogoSpriteFrame: SpriteFrame = null;

    @property({ type: PlayableAdsController, tooltip: 'Playable Ads network controller script' })
    public adsController: PlayableAdsController = null;

    @property({ type: CCFloat, tooltip: 'Countdown delay before showing the exit button (Default: 5.0 seconds)' })
    public exitDelay: number = 5.0;

    private _isAdShowing: boolean = false;
    private _isExitClicked: boolean = false;

    onLoad() {
        ADCtrl.instance = this;
        this.resolveReferences();
        this.applyButtonScaleEffect();

        // Mặc định ẩn màn hình AD nếu chưa đến lúc showAD
        if (!this._isAdShowing) {
            this.node.active = false;
            if (this.popupWinNode) this.popupWinNode.active = false;
            if (this.popupLoseNode) this.popupLoseNode.active = false;
        }
        if (this.endPointNode) {
            this.endPointNode.active = false;
        }

        EventManager.instance.on(GameEvent.GAME_WIN, this.showAD, this);

        // Bấm vào bất kỳ điểm nào trên màn hình AD đều mở Store
        this.node.on(Node.EventType.TOUCH_END, this.onScreenClicked, this);

        // Gắn sự kiện nút thoát cho EndPoint nếu có
        if (this.endPointNode) {
            this.endPointNode.on(Node.EventType.TOUCH_END, this.onExitClicked, this);
            const exitChild = this.endPointNode.getChildByName('Exit');
            if (exitChild) {
                exitChild.on(Node.EventType.TOUCH_END, this.onExitClicked, this);
            }
            const btn = this.endPointNode.getComponentInChildren(Button);
            if (btn) {
                btn.node.on(Button.EventType.CLICK, this.onExitClicked, this);
                btn.node.on(Node.EventType.TOUCH_END, this.onExitClicked, this);
            }
        }
    }

    onDisable() {
        this._isAdShowing = false;
        input.off(Input.EventType.TOUCH_END, this.onGlobalScreenTouched, this);
    }

    onDestroy() {
        if (ADCtrl.instance === this) {
            ADCtrl.instance = null;
        }
        this._isAdShowing = false;
        input.off(Input.EventType.TOUCH_END, this.onGlobalScreenTouched, this);
        EventManager.instance.off(GameEvent.GAME_WIN, this.showAD, this);
        this.node.off(Node.EventType.TOUCH_END, this.onScreenClicked, this);
        if (this.popupLoseNode && this.popupLoseNode.isValid) {
            this.popupLoseNode.off(Node.EventType.TOUCH_END, this.onScreenClicked, this);
        }
        if (this.endPointNode && this.endPointNode.isValid) {
            this.endPointNode.off(Node.EventType.TOUCH_END, this.onExitClicked, this);
            const exitChild = this.endPointNode.getChildByName('Exit');
            if (exitChild && exitChild.isValid) {
                exitChild.off(Node.EventType.TOUCH_END, this.onExitClicked, this);
            }
            const btn = this.endPointNode.getComponentInChildren(Button);
            if (btn && btn.node && btn.node.isValid) {
                btn.node.off(Button.EventType.CLICK, this.onExitClicked, this);
                btn.node.off(Node.EventType.TOUCH_END, this.onExitClicked, this);
            }
        }
    }

    private resolveReferences() {
        if (!this.endPointNode) {
            this.endPointNode = this.node.getChildByName('EndPoint')
                || this.node.parent?.getChildByName('EndPoint')
                || this.node.scene?.getChildByPath('UI/EndPoint');
        }
        if (!this.popupWinNode) {
            this.popupWinNode = this.node.getChildByName('PopupWin');
        }
        if (!this.popupLoseNode) {
            this.popupLoseNode = this.node.parent?.getChildByName('PopupLose')
                || this.node.getChildByName('PopupLose')
                || this.node.scene?.getChildByPath('UI/PopupLose');
        }
        if (!this.adsController) {
            this.adsController = PlayableAdsController.instance
                || this.getComponent(PlayableAdsController)
                || this.node.scene?.getComponentInChildren(PlayableAdsController);
        }
        this.fixPopupLoseLogo();
    }

    /**
     * Đảm bảo các nút Play Now và EndPoint Exit chỉ phóng to khi hover/touch (Transition.SCALE),
     * không bị đè layer màu hay đổi sprite gây xấu giao diện
     */
    private applyButtonScaleEffect() {
        const buttons = this.node.getComponentsInChildren(Button);
        for (const btn of buttons) {
            if (btn) {
                btn.transition = Button.Transition.SCALE;
                btn.zoomScale = 1.15;
                btn.duration = 0.1;
                btn.hoverSprite = null;
                btn.pressedSprite = null;
                btn.disabledSprite = null;
            }
        }
        if (this.endPointNode) {
            const endButtons = this.endPointNode.getComponentsInChildren(Button);
            for (const btn of endButtons) {
                if (btn) {
                    btn.transition = Button.Transition.SCALE;
                    btn.zoomScale = 1.15;
                    btn.duration = 0.1;
                    btn.hoverSprite = null;
                    btn.pressedSprite = null;
                    btn.disabledSprite = null;
                }
            }
        }
    }

    public showAD() {
        this._isAdShowing = true;
        this.node.active = true;
        this.resolveReferences();
        this.applyButtonScaleEffect();

        // Phát âm thanh Victory ngay khi AD xuất hiện theo đúng yêu cầu
        if (AudioManager.instance) {
            AudioManager.instance.playVictory();
        }

        // Phủ toàn màn hình để mọi cú chạm trên màn hình đều trúng AD
        const uiTrans = this.node.getComponent(UITransform);
        if (uiTrans) {
            const vs = view.getVisibleSize();
            uiTrans.setContentSize(Math.max(vs.width, 3000), Math.max(vs.height, 3000));
        }

        // Đăng ký bắt chạm toàn cục toàn màn hình ngay khi AD xuất hiện
        input.off(Input.EventType.TOUCH_END, this.onGlobalScreenTouched, this);
        input.on(Input.EventType.TOUCH_END, this.onGlobalScreenTouched, this);

        if (this.popupLoseNode) {
            this.popupLoseNode.active = false;
        }
        if (this.popupWinNode) {
            // Đưa node AD lên trên các HUD/Banner (ngay dưới EndPoint)
            const uiRoot = this.node.parent;
            if (uiRoot) {
                const targetIdx = Math.max(0, uiRoot.children.length - 2);
                this.node.setSiblingIndex(targetIdx);
            }
            this.popupWinNode.active = true;
            for (let i = 0; i < this.popupWinNode.children.length; i++) {
                this.popupWinNode.children[i].active = true;
            }
            const targetScale = this.popupWinNode.scale.x > 0.05 ? this.popupWinNode.scale.x : 1.0;
            Tween.stopAllByTarget(this.popupWinNode);
            this.popupWinNode.setScale(targetScale * 0.35, targetScale * 0.35, 1);
            tween(this.popupWinNode)
                .to(0.28, { scale: new Vec3(targetScale * 1.06, targetScale * 1.06, 1) }, { easing: 'backOut' })
                .to(0.12, { scale: new Vec3(targetScale, targetScale, 1) })
                .start();

            const winCtrl = this.popupWinNode.getComponent(WinPopCtrl);
            if (winCtrl) {
                winCtrl.enabled = true;
                winCtrl.startPulse();
            }
            this.popupWinNode.off(Node.EventType.TOUCH_END, this.onScreenClicked, this);
            this.popupWinNode.on(Node.EventType.TOUCH_END, this.onScreenClicked, this);
        }

        // Tắt hẳn Joystick khi hiện AD theo đúng yêu cầu
        const controlNode = this.node.scene?.getChildByPath('UI/Control')
            || this.node.parent?.getChildByName('Control');
        if (controlNode) {
            controlNode.active = false;
        }

        if (this.endPointNode) {
            this.endPointNode.active = false;
            const uiRoot = this.node.parent;
            if (uiRoot && this.endPointNode.parent === uiRoot) {
                this.endPointNode.setSiblingIndex(uiRoot.children.length - 1);
            }
            // Bắt đầu đếm ngược đúng 5.0 giây theo yêu cầu để hiện nút thoát
            this.scheduleOnce(() => {
                if (this.endPointNode && this.node.active) {
                    this.endPointNode.active = true;
                    this.ensureExitButtonVisible();
                }
            }, this.exitDelay);
        }
    }

    /**
     * Hiển thị màn hình Thất Bại (PopupLose / Failed.prefab), khóa Joystick,
     * bắt chạm toàn màn hình mở Store và đếm ngược hiện nút Exit sau 5s.
     */
    public showLoseAD() {
        this._isAdShowing = true;
        this.node.active = true;
        this.resolveReferences();
        this.applyButtonScaleEffect();

        if (AudioManager.instance) {
            AudioManager.instance.playFail();
        }

        const uiTrans = this.node.getComponent(UITransform);
        if (uiTrans) {
            const vs = view.getVisibleSize();
            uiTrans.setContentSize(Math.max(vs.width, 3000), Math.max(vs.height, 3000));
        }

        input.off(Input.EventType.TOUCH_END, this.onGlobalScreenTouched, this);
        input.on(Input.EventType.TOUCH_END, this.onGlobalScreenTouched, this);

        if (this.popupWinNode) {
            this.popupWinNode.active = false;
        }

        if (!this.popupLoseNode && this.failedPrefab) {
            this.popupLoseNode = instantiate(this.failedPrefab);
            this.popupLoseNode.name = 'PopupLose';
            this.popupLoseNode.setParent(this.node.parent || this.node);
        }

        if (this.popupLoseNode) {
            const comps = this.popupLoseNode.getComponentsInChildren(Component);
            for (let i = 0; i < comps.length; i++) {
                const c = comps[i];
                if (c && js.getClassName(c) === 'GameLoseManager') {
                    c.enabled = false;
                }
            }
            // Đưa PopupLose lên trên các HUD/Banner (ngay dưới EndPoint)
            const uiRoot = this.popupLoseNode.parent;
            if (uiRoot) {
                const targetIdx = Math.max(0, uiRoot.children.length - 2);
                this.popupLoseNode.setSiblingIndex(targetIdx);
            }
            // QUAN TRỌNG: Bật cả Content & các node hiển thị bên trong Failed.prefab
            const contentNode = this.popupLoseNode.getChildByName('Content');
            if (contentNode) {
                contentNode.active = true;
                for (let i = 0; i < contentNode.children.length; i++) {
                    contentNode.children[i].active = true;
                }
            }
            this.fixPopupLoseLogo();
            this.popupLoseNode.active = true;
            this.animateLosePopupIn(this.popupLoseNode);
            this.popupLoseNode.off(Node.EventType.TOUCH_END, this.onScreenClicked, this);
            this.popupLoseNode.on(Node.EventType.TOUCH_END, this.onScreenClicked, this);
            const btn = this.findChildRecursive(this.popupLoseNode, 'Button')
                || this.findChildRecursive(this.popupLoseNode, 'btn')
                || this.findChildRecursive(this.popupLoseNode, 'PlayNow');
            if (btn) {
                btn.off(Node.EventType.TOUCH_END, this.onScreenClicked, this);
                btn.on(Node.EventType.TOUCH_END, this.onScreenClicked, this);
            }
        } else if (this.popupWinNode) {
            this.popupWinNode.active = true;
        }

        const controlNode = this.node.scene?.getChildByPath('UI/Control')
            || this.node.parent?.getChildByName('Control');
        if (controlNode) {
            controlNode.active = false;
        }

        if (this.endPointNode) {
            this.endPointNode.active = false;
            const uiRoot = this.node.parent;
            if (uiRoot && this.endPointNode.parent === uiRoot) {
                this.endPointNode.setSiblingIndex(uiRoot.children.length - 1);
            }
            this.scheduleOnce(() => {
                if (this.endPointNode && this.node.active) {
                    this.endPointNode.active = true;
                    this.ensureExitButtonVisible();
                }
            }, this.exitDelay);
        }
    }

    private ensureExitButtonVisible() {
        if (!this.endPointNode || !this.endPointNode.isValid) return;
        const exitChild = this.endPointNode.getChildByName('Exit');
        if (exitChild) {
            exitChild.active = true;
            const lbl = exitChild.getComponent(Label);
            if (lbl && (!lbl.string || lbl.string === '?')) {
                lbl.string = 'X';
            }
        }
    }

    private fixPopupLoseLogo() {
        if (!this.popupLoseNode || !this.popupLoseNode.isValid) return;
        const logoNode = this.findChildRecursive(this.popupLoseNode, 'logo');
        if (!logoNode) return;
        const sp = logoNode.getComponent(Sprite);
        if (!sp) return;

        if (this.gameLogoSpriteFrame) {
            sp.spriteFrame = this.gameLogoSpriteFrame;
        } else {
            assetManager.loadAny(GAME_LOGO_UUID, (err, sf: SpriteFrame) => {
                if (!err && sf && sp && sp.isValid) {
                    this.gameLogoSpriteFrame = sf;
                    sp.spriteFrame = sf;
                }
            });
        }
    }

    private findChildRecursive(root: Node, name: string): Node | null {
        if (!root) return null;
        if (root.name === name) return root;
        for (let i = 0; i < root.children.length; i++) {
            const found = this.findChildRecursive(root.children[i], name);
            if (found) return found;
        }
        return null;
    }

    private animateLosePopupIn(target: Node) {
        const baseScale = target.scale.x > 0.05 ? target.scale.x : 1.0;
        Tween.stopAllByTarget(target);
        target.setScale(baseScale * 0.28, baseScale * 0.28, 1);
        tween(target)
            .to(0.32, { scale: new Vec3(baseScale * 1.05, baseScale * 1.05, 1) }, { easing: 'backOut' })
            .to(0.12, { scale: new Vec3(baseScale, baseScale, 1) })
            .start();

        const btnNode = this.findChildRecursive(target, 'Button')
            || this.findChildRecursive(target, 'btn')
            || this.findChildRecursive(target, 'PlayNow');
        if (btnNode) {
            Tween.stopAllByTarget(btnNode);
            tween(btnNode)
                .repeatForever(
                    tween()
                        .to(0.45, { scale: new Vec3(1.08, 1.08, 1) })
                        .to(0.45, { scale: new Vec3(0.96, 0.96, 1) })
                )
                .start();
        }
    }

    private onGlobalScreenTouched(event: EventTouch) {
        if (!this._isAdShowing || !this.node.activeInHierarchy) return;

        // Nếu người chơi chạm trúng nút thoát Exit (EndPoint), bỏ qua không mở store
        if (this._isExitClicked) {
            this._isExitClicked = false;
            return;
        }

        this.onScreenClicked();
    }

    private onScreenClicked() {
        if (!this.adsController) {
            this.resolveReferences();
        }

        if (this.adsController) {
            this.adsController.installHandle();
        } else {
            console.log('[ADCtrl] Clicked Screen -> Open App Store');
        }
    }

    private onExitClicked(event: any) {
        this._isExitClicked = true;
        // Ngăn sự kiện nổi bọt lên màn hình AD để không mở Store nếu bấm trúng nút Exit
        if (event && typeof event.propagationStopped !== 'undefined') {
            event.propagationStopped = true;
        }
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        console.log('[ADCtrl] User clicked Exit button on EndPoint -> Closing WebView');

        if (!this.adsController) {
            this.resolveReferences();
        }

        // 1. Gọi lệnh đóng WebView chuyên dụng cho mạng quảng cáo (mraid.close, dapi.close, window.close...)
        if (this.adsController) {
            this.adsController.closeAd();
        }

        // 2. Dừng nhạc nền nếu có
        if (AudioManager.instance) {
            AudioManager.instance.stopBGM();
        }

        // 3. Ẩn toàn bộ giao diện AD và EndPoint
        this.node.active = false;
        if (this.endPointNode) {
            this.endPointNode.active = false;
        }

        // 4. Phản hồi thị giác rõ ràng cho browser preview (mô phỏng WebView đã đóng)
        this._showClosedScreenFeedback();
    }

    private _showClosedScreenFeedback() {
        const parent = this.node.parent || this.node.scene;
        if (!parent) return;

        let closeOverlay = parent.getChildByName('ClosedWebViewOverlay');
        if (!closeOverlay) {
            closeOverlay = new Node('ClosedWebViewOverlay');
            closeOverlay.layer = this.node.layer;
            parent.addChild(closeOverlay);

            const uiTrans = closeOverlay.addComponent(UITransform);
            const vs = view.getVisibleSize();
            uiTrans.setContentSize(Math.max(vs.width, 3000), Math.max(vs.height, 3000));

            const g = closeOverlay.addComponent(Graphics);
            g.fillColor = new Color(10, 10, 10, 250);
            g.fillRect(-1500, -1500, 3000, 3000);

            const labelNode = new Node('CloseText');
            labelNode.layer = closeOverlay.layer;
            closeOverlay.addChild(labelNode);
            const lblTrans = labelNode.addComponent(UITransform);
            lblTrans.setContentSize(900, 200);
            const lbl = labelNode.addComponent(Label);
            lbl.string = "PLAYABLE AD CLOSED\n[WebView Exited - mraid.close()]";
            lbl.fontSize = 32;
            lbl.lineHeight = 46;
            lbl.color = new Color(220, 220, 220, 255);
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;
        }

        closeOverlay.active = true;
        try {
            director.pause();
        } catch (e) {}
    }
}
