import { _decorator, Component, Node, CCFloat, Button, UITransform, view, input, Input, EventTouch, director, Color, Graphics, Label } from 'cc';
import PlayableAdsController from '../ADS/PlayableAdsController';
import { EventManager, GameEvent } from '../System/EventManager';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('ADCtrl')
export class ADCtrl extends Component {
    @property({ type: Node, tooltip: 'Node containing the exit button after 5 seconds (EndPoint)' })
    public endPointNode: Node = null;

    @property({ type: Node, tooltip: 'Victory popup node (PopupWin)' })
    public popupWinNode: Node = null;

    @property({ type: PlayableAdsController, tooltip: 'Playable Ads network controller script' })
    public adsController: PlayableAdsController = null;

    @property({ type: CCFloat, tooltip: 'Countdown delay before showing the exit button (Default: 5.0 seconds)' })
    public exitDelay: number = 5.0;

    private _isAdShowing: boolean = false;
    private _isExitClicked: boolean = false;

    onLoad() {
        this.resolveReferences();
        this.applyButtonScaleEffect();

        // Mặc định ẩn màn hình AD nếu chưa đến lúc showAD
        if (!this._isAdShowing) {
            this.node.active = false;
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
        this._isAdShowing = false;
        input.off(Input.EventType.TOUCH_END, this.onGlobalScreenTouched, this);
        EventManager.instance.off(GameEvent.GAME_WIN, this.showAD, this);
        this.node.off(Node.EventType.TOUCH_END, this.onScreenClicked, this);
        if (this.endPointNode) {
            this.endPointNode.off(Node.EventType.TOUCH_END, this.onExitClicked, this);
            const btn = this.endPointNode.getComponentInChildren(Button);
            if (btn) {
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
        if (!this.adsController) {
            this.adsController = PlayableAdsController.instance
                || this.getComponent(PlayableAdsController)
                || this.node.scene?.getComponentInChildren(PlayableAdsController);
        }
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

        if (this.popupWinNode) {
            this.popupWinNode.active = true;
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
            // Bắt đầu đếm ngược đúng 5.0 giây theo yêu cầu để hiện nút thoát
            this.scheduleOnce(() => {
                if (this.endPointNode && this.node.active) {
                    this.endPointNode.active = true;
                }
            }, this.exitDelay);
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
