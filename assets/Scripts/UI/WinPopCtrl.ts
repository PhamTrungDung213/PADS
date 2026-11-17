import { _decorator, Component, Node, Vec3, tween, Button } from 'cc';
import PlayableAdsController from '../ADS/PlayableAdsController';

const { ccclass, property } = _decorator;

@ccclass('WinPopCtrl')
export class WinPopCtrl extends Component {
    @property({ type: Node, tooltip: 'Call-to-Action button for continuous pulse bounce animation' })
    public ctaButton: Node = null;

    @property({ type: PlayableAdsController, tooltip: 'Playable Ads network controller script' })
    public adsController: PlayableAdsController = null;

    private _tweenAnim: any = null;
    private _baseScale: Vec3 = new Vec3(0.7, 0.7, 1.0);

    onLoad() {
        if (!this.ctaButton) {
            this.ctaButton = this.node.getChildByName('Finish')
                || this.node.getChildByName('Button')
                || this.node.getChildByName('CTA')
                || this.node;
        }
        if (this.ctaButton) {
            const curScale = this.ctaButton.scale;
            if (curScale.x > 0.01) {
                this._baseScale.set(curScale);
            }
        }
        if (!this.adsController) {
            this.adsController = PlayableAdsController.instance
                || this.getComponent(PlayableAdsController)
                || this.node.scene?.getComponentInChildren(PlayableAdsController);
        }

        this.node.on(Node.EventType.TOUCH_END, this.onCtaClick, this);
        const btn = this.getComponent(Button) || this.ctaButton?.getComponent(Button);
        if (btn) {
            btn.node.on(Button.EventType.CLICK, this.onCtaClick, this);
        }
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onCtaClick, this);
        const btn = this.getComponent(Button) || this.ctaButton?.getComponent(Button);
        if (btn) {
            btn.node.off(Button.EventType.CLICK, this.onCtaClick, this);
        }
        this.stopPulse();
    }

    onEnable() {
        this.startPulse();
    }

    onDisable() {
        this.stopPulse();
    }

    public startPulse() {
        if (!this.ctaButton) return;
        this.stopPulse();

        const base = this._baseScale;
        this.ctaButton.setScale(base);

        // Hiệu ứng nhịp đập liên tục nảy nảy (Bouncy Pulse) mời gọi bấm chuẩn Playable Ads
        const sBig = new Vec3(base.x * 1.22, base.y * 1.22, base.z);
        const sSmall = new Vec3(base.x * 0.94, base.y * 0.94, base.z);
        const sMid = new Vec3(base.x * 1.10, base.y * 1.10, base.z);

        this._tweenAnim = tween(this.ctaButton)
            .to(0.32, { scale: sBig }, { easing: 'sineOut' })
            .to(0.20, { scale: sSmall }, { easing: 'sineIn' })
            .to(0.15, { scale: sMid }, { easing: 'quadOut' })
            .to(0.15, { scale: base }, { easing: 'quadIn' })
            .delay(0.10)
            .union()
            .repeatForever()
            .start();
    }

    public stopPulse() {
        if (this._tweenAnim) {
            this._tweenAnim.stop();
            this._tweenAnim = null;
        }
    }

    private onCtaClick() {
        if (!this.adsController) {
            this.adsController = PlayableAdsController.instance
                || this.getComponent(PlayableAdsController)
                || this.node.scene?.getComponentInChildren(PlayableAdsController);
        }

        if (this.adsController) {
            this.adsController.installHandle();
        } else {
            console.log('[WinPopCtrl] Clicked CTA button -> Open Store');
        }
    }
}
