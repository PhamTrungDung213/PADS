import {
    _decorator,
    Component,
    Node,
    Label,
    Sprite,
    SpriteFrame,
    Color,
    Vec3,
    UITransform,
    UIOpacity,
    tween,
    Tween,
    assetManager,
    TTFFont,
} from 'cc';
import { EventManager } from '../System/EventManager';
import { DEFCHEST_EVENT_TREASURE_CHANGED } from './DefChestTreasureChest';

const { ccclass, property } = _decorator;

export type DefChestBannerStyle = 'GOLD' | 'ORANGE' | 'RED' | 'VICTORY' | 'DEFEAT';

const SOLID_WHITE_UUID = 'eb5dd527-4b6d-4269-8147-2a26fe866f0d@f9941';
const HORIZONTAL_GLOW_UUID = 'dec2a521-181e-4cdc-b217-82b3170af503@f9941';
const EXTRABOLD_FONT_UUID = 'db01ffe9-8b2e-49fc-b100-155140bf9c2f';

const GRP_HUD = { name: '1. HUD Đỉnh Màn Hình', id: 'hud_top', displayOrder: 1, style: 'section' };
const GRP_BANNER = { name: '2. Banner Cảnh Báo Phase (Dài Đều Ngang)', id: 'hud_banner', displayOrder: 2, style: 'section' };

const C_TITLE = new Color(255, 226, 72, 255);
const C_STATUS_OK = new Color(255, 250, 225, 255);
const C_STATUS_LOW = new Color(255, 95, 85, 255);
const C_ALERT = new Color(255, 75, 60, 255);
const C_OUTLINE_DARK = new Color(16, 8, 4, 255);
const C_SHADOW = new Color(0, 0, 0, 150);

interface BannerTheme {
    bg: Color;
    glow: Color;
    stripe: Color;
    inner: Color;
}

const BANNER_THEMES: Record<DefChestBannerStyle, BannerTheme> = {
    GOLD: {
        bg: new Color(34, 24, 12, 234),
        glow: new Color(255, 206, 68, 105),
        stripe: new Color(255, 204, 52, 255),
        inner: new Color(255, 244, 186, 185),
    },
    ORANGE: {
        bg: new Color(46, 20, 8, 236),
        glow: new Color(255, 138, 36, 118),
        stripe: new Color(255, 132, 28, 255),
        inner: new Color(255, 214, 148, 195),
    },
    RED: {
        bg: new Color(56, 8, 12, 240),
        glow: new Color(255, 42, 42, 130),
        stripe: new Color(255, 48, 48, 255),
        inner: new Color(255, 168, 168, 205),
    },
    DEFEAT: {
        bg: new Color(56, 8, 12, 240),
        glow: new Color(255, 42, 42, 130),
        stripe: new Color(255, 48, 48, 255),
        inner: new Color(255, 168, 168, 205),
    },
    VICTORY: {
        bg: new Color(14, 48, 24, 238),
        glow: new Color(115, 255, 128, 115),
        stripe: new Color(255, 216, 56, 255),
        inner: new Color(195, 255, 195, 205),
    },
};

const _tmpGlowColor = new Color();
const _vBannerOpenOver = new Vec3(1.0, 1.07, 1.0);
const _vBannerOne = new Vec3(1.0, 1.0, 1.0);
const _vBannerClose = new Vec3(1.0, 0.04, 1.0);

/** HUD mục tiêu trên đỉnh màn hình và Banner cảnh báo Phase trải dài ngang toàn màn hình. */
@ccclass('DefChestHUD')
export class DefChestHUD extends Component {
    public static instance: DefChestHUD | null = null;

    @property({ group: GRP_HUD, type: Label, tooltip: 'Label tiêu đề mục tiêu' })
    public titleLabel: Label = null;

    @property({ group: GRP_HUD, type: Label, tooltip: 'Label hiển thị Wave & % kho báu' })
    public statusLabel: Label = null;

    @property({ group: GRP_HUD, type: Label, tooltip: 'Label cảnh báo đỏ khi Rương bị trộm' })
    public alertLabel: Label = null;

    @property({ group: GRP_BANNER, type: Node, tooltip: 'Node Banner cảnh báo dài ngang (UI/WaveBanner)' })
    public waveBannerNode: Node = null;

    @property({ group: GRP_BANNER, type: Sprite, tooltip: 'Dải nền ngang chính (BannerBg)' })
    public waveBannerBgSprite: Sprite = null;

    @property({ group: GRP_BANNER, type: Sprite, tooltip: 'Vệt phát quang giữa Banner (BannerGlow)' })
    public waveBannerGlowSprite: Sprite = null;

    @property({ group: GRP_BANNER, type: Sprite, tooltip: 'Thanh viền trên (StripeTop)' })
    public waveBannerStripeTop: Sprite = null;

    @property({ group: GRP_BANNER, type: Sprite, tooltip: 'Thanh viền dưới (StripeBot)' })
    public waveBannerStripeBot: Sprite = null;

    @property({ group: GRP_BANNER, type: Sprite, tooltip: 'Đường sáng mảnh trên (InnerLineTop)' })
    public waveBannerInnerTop: Sprite = null;

    @property({ group: GRP_BANNER, type: Sprite, tooltip: 'Đường sáng mảnh dưới (InnerLineBot)' })
    public waveBannerInnerBot: Sprite = null;

    @property({ group: GRP_BANNER, type: Label, tooltip: 'Chữ thông báo lớn trên Banner (BannerLabel)' })
    public waveBannerLabel: Label = null;

    @property({ group: GRP_BANNER, type: SpriteFrame, tooltip: 'SpriteFrame trắng phẳng cho dải ngang' })
    public solidStripSpriteFrame: SpriteFrame = null;

    @property({ group: GRP_BANNER, type: SpriteFrame, tooltip: 'SpriteFrame gradient phát quang giữa' })
    public glowStripSpriteFrame: SpriteFrame = null;

    private _currentWave: number = 1;
    private _treasurePercent: number = 100;
    private _bannerTimer: number = 0;
    private _bannerPulsePhase: number = 0;
    private _activeBannerStyle: DefChestBannerStyle = 'GOLD';
    private _isBeingStolen: boolean = false;
    private _pulsePhase: number = 0;

    protected onLoad(): void {
        DefChestHUD.instance = this;
        this.ensureHudLabels();
        this.ensureWaveBanner();
        EventManager.instance.on(DEFCHEST_EVENT_TREASURE_CHANGED, this.onTreasureChanged, this);
    }

    protected onDestroy(): void {
        EventManager.instance.off(DEFCHEST_EVENT_TREASURE_CHANGED, this.onTreasureChanged, this);
        if (DefChestHUD.instance === this) DefChestHUD.instance = null;
    }

    private ensureHudLabels(): void {
        const makeLabel = (name: string, posY: number, fontSize: number, color: Color, text: string): Label => {
            let n = this.node.getChildByName(name);
            if (!n) {
                n = new Node(name);
                n.layer = this.node.layer;
                n.setParent(this.node);
                n.setPosition(0, posY, 0);
                n.addComponent(UITransform).setContentSize(880, fontSize + 24);
            }
            const lbl = n.getComponent(Label) || n.addComponent(Label);
            lbl.fontSize = fontSize;
            lbl.lineHeight = fontSize + 8;
            lbl.isBold = true;
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;
            lbl.color = color;
            lbl.enableOutline = true;
            lbl.outlineColor = C_OUTLINE_DARK;
            lbl.outlineWidth = 4;
            if (!lbl.string) lbl.string = text;
            return lbl;
        };

        if (!this.titleLabel) this.titleLabel = makeLabel('TitleLabel', 38, 38, C_TITLE, 'DEFEND THE TREASURE');
        if (!this.statusLabel) this.statusLabel = makeLabel('StatusLabel', -10, 28, C_STATUS_OK, 'WAVE 1/3  •  TREASURE: 100%');
        if (!this.alertLabel) this.alertLabel = makeLabel('AlertLabel', -62, 30, C_ALERT, '');
        if (this.alertLabel) this.alertLabel.node.active = false;
    }

    private ensureWaveBanner(): void {
        const uiRoot = this.node.parent || this.node;
        if (!this.waveBannerNode) {
            this.waveBannerNode = uiRoot.getChildByName('WaveBanner') || this.node.getChildByName('WaveBanner');
        }
        if (!this.waveBannerNode) {
            const root = new Node('WaveBanner');
            root.layer = this.node.layer;
            root.setParent(uiRoot);
            root.setPosition(0, 260, 0);
            root.addComponent(UITransform).setContentSize(2600, 176);
            root.addComponent(UIOpacity);
            this.waveBannerNode = root;
        }
        if (!this.waveBannerNode.getComponent(UIOpacity)) {
            this.waveBannerNode.addComponent(UIOpacity);
        }

        const getOrMakeSprite = (name: string, w: number, h: number, y: number, color: Color): Sprite => {
            let n = this.waveBannerNode.getChildByName(name);
            if (!n) {
                n = new Node(name);
                n.layer = this.node.layer;
                n.setParent(this.waveBannerNode);
                n.setPosition(0, y, 0);
                n.addComponent(UITransform).setContentSize(w, h);
            }
            const sp = n.getComponent(Sprite) || n.addComponent(Sprite);
            sp.type = Sprite.Type.SIMPLE;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.color = color;
            return sp;
        };

        const defTheme = BANNER_THEMES.GOLD;
        const outerShadow = getOrMakeSprite('OuterShadow', 2600, 176, 0, C_SHADOW);
        if (!this.waveBannerBgSprite) this.waveBannerBgSprite = getOrMakeSprite('BannerBg', 2600, 146, 0, defTheme.bg);
        if (!this.waveBannerGlowSprite) this.waveBannerGlowSprite = getOrMakeSprite('BannerGlow', 1500, 140, 0, defTheme.glow);
        if (!this.waveBannerStripeTop) this.waveBannerStripeTop = getOrMakeSprite('StripeTop', 2600, 10, 73, defTheme.stripe);
        if (!this.waveBannerStripeBot) this.waveBannerStripeBot = getOrMakeSprite('StripeBot', 2600, 10, -73, defTheme.stripe);
        if (!this.waveBannerInnerTop) this.waveBannerInnerTop = getOrMakeSprite('InnerLineTop', 2600, 3, 60, defTheme.inner);
        if (!this.waveBannerInnerBot) this.waveBannerInnerBot = getOrMakeSprite('InnerLineBot', 2600, 3, -60, defTheme.inner);

        const applySolid = (sf: SpriteFrame) => {
            if (!this.isValid) return;
            const list = [outerShadow, this.waveBannerBgSprite, this.waveBannerStripeTop, this.waveBannerStripeBot, this.waveBannerInnerTop, this.waveBannerInnerBot];
            for (let i = 0; i < list.length; i++) {
                if (list[i] && list[i].isValid) list[i].spriteFrame = sf;
            }
        };
        if (this.solidStripSpriteFrame) applySolid(this.solidStripSpriteFrame);
        else assetManager.loadAny(SOLID_WHITE_UUID, (err, sf: SpriteFrame) => { if (!err && sf) { this.solidStripSpriteFrame = sf; applySolid(sf); } });

        const applyGlow = (sf: SpriteFrame) => {
            if (this.isValid && this.waveBannerGlowSprite && this.waveBannerGlowSprite.isValid) {
                this.waveBannerGlowSprite.spriteFrame = sf;
            }
        };
        if (this.glowStripSpriteFrame) applyGlow(this.glowStripSpriteFrame);
        else assetManager.loadAny(HORIZONTAL_GLOW_UUID, (err, sf: SpriteFrame) => { if (!err && sf) { this.glowStripSpriteFrame = sf; applyGlow(sf); } });

        if (!this.waveBannerLabel) {
            let lblNode = this.waveBannerNode.getChildByName('BannerLabel');
            if (!lblNode) {
                lblNode = new Node('BannerLabel');
                lblNode.layer = this.node.layer;
                lblNode.setParent(this.waveBannerNode);
                lblNode.setPosition(0, 0, 0);
                lblNode.addComponent(UITransform).setContentSize(980, 122);
            }
            const lbl = lblNode.getComponent(Label) || lblNode.addComponent(Label);
            lbl.fontSize = 68;
            lbl.lineHeight = 76;
            lbl.isBold = true;
            lbl.overflow = Label.Overflow.SHRINK;
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;
            lbl.enableOutline = true;
            lbl.outlineColor = C_OUTLINE_DARK;
            lbl.outlineWidth = 6;
            assetManager.loadAny(EXTRABOLD_FONT_UUID, (err, font: TTFFont) => {
                if (!err && font && lbl.isValid) {
                    lbl.useSystemFont = false;
                    lbl.font = font;
                }
            });
            this.waveBannerLabel = lbl;
        }

        this.waveBannerNode.active = false;
    }

    public setWaveInfo(waveIndex: number, killed: number = 0, total: number = 0): void {
        this._currentWave = waveIndex;
        this.refreshStatusString(killed, total);
    }

    private onTreasureChanged(current: number, max: number, isStealing: boolean): void {
        this._treasurePercent = max > 0 ? Math.max(0, Math.round((current / max) * 100)) : 0;
        this._isBeingStolen = isStealing;
        this.refreshStatusString();

        if (this.alertLabel) {
            this.alertLabel.node.active = isStealing;
            if (isStealing) {
                this.alertLabel.string = 'WARNING: TREASURE BEING STOLEN!';
                this.alertLabel.color = C_ALERT;
            }
        }
    }

    private refreshStatusString(killed?: number, total?: number): void {
        if (!this.statusLabel) return;
        const waveText = this._currentWave >= 3 ? 'LAST WAVE' : `WAVE ${this._currentWave}/3`;
        const progressPart = total && total > 0 ? ` (${killed}/${total})` : '';
        this.statusLabel.string = `${waveText}${progressPart}  •  TREASURE: ${this._treasurePercent}%`;
        this.statusLabel.color = this._treasurePercent <= 35 ? C_STATUS_LOW : C_STATUS_OK;
    }

    public showBannerAnnouncement(
        message: string,
        color: Color = C_TITLE,
        duration: number = 2.5,
        style: DefChestBannerStyle = 'GOLD'
    ): void {
        if (!this.waveBannerNode || !this.waveBannerLabel) this.ensureWaveBanner();
        if (!this.waveBannerNode || !this.waveBannerLabel) return;

        this._bannerTimer = duration;
        this._bannerPulsePhase = 0;
        this._activeBannerStyle = style;

        this.waveBannerNode.active = true;
        this.waveBannerLabel.string = message;
        this.waveBannerLabel.color = color;
        this.applyBannerStyle(style);

        const op = this.waveBannerNode.getComponent(UIOpacity) || this.waveBannerNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(this.waveBannerNode);
        Tween.stopAllByTarget(op);
        Tween.stopAllByTarget(this.waveBannerLabel.node);

        op.opacity = 0;
        this.waveBannerNode.setScale(1.0, 0.06, 1.0);
        this.waveBannerLabel.node.setScale(1.24, 1.24, 1.0);

        tween(op).to(0.14, { opacity: 255 }).start();
        tween(this.waveBannerNode)
            .to(0.20, { scale: _vBannerOpenOver }, { easing: 'backOut' })
            .to(0.10, { scale: _vBannerOne })
            .start();
        tween(this.waveBannerLabel.node)
            .to(0.24, { scale: _vBannerOne }, { easing: 'quadOut' })
            .start();
    }

    private applyBannerStyle(style: DefChestBannerStyle): void {
        const t = BANNER_THEMES[style] || BANNER_THEMES.GOLD;
        if (this.waveBannerBgSprite) this.waveBannerBgSprite.color = t.bg;
        if (this.waveBannerGlowSprite) this.waveBannerGlowSprite.color = t.glow;
        if (this.waveBannerStripeTop) this.waveBannerStripeTop.color = t.stripe;
        if (this.waveBannerStripeBot) this.waveBannerStripeBot.color = t.stripe;
        if (this.waveBannerInnerTop) this.waveBannerInnerTop.color = t.inner;
        if (this.waveBannerInnerBot) this.waveBannerInnerBot.color = t.inner;
    }

    protected update(dt: number): void {
        if (this._bannerTimer > 0 && this.waveBannerNode && this.waveBannerNode.active) {
            const isDanger = this._activeBannerStyle === 'RED' || this._activeBannerStyle === 'DEFEAT';
            this._bannerPulsePhase += dt * (isDanger ? 10.5 : 6.0);
            if (this.waveBannerGlowSprite) {
                const c = this.waveBannerGlowSprite.color;
                const a = Math.round((isDanger ? 125 : 100) + Math.sin(this._bannerPulsePhase) * 42);
                _tmpGlowColor.set(c.r, c.g, c.b, Math.max(40, Math.min(200, a)));
                this.waveBannerGlowSprite.color = _tmpGlowColor;
            }

            this._bannerTimer -= dt;
            if (this._bannerTimer <= 0) {
                const op = this.waveBannerNode.getComponent(UIOpacity);
                Tween.stopAllByTarget(this.waveBannerNode);
                tween(this.waveBannerNode).to(0.22, { scale: _vBannerClose }, { easing: 'quadIn' }).start();
                if (op) {
                    Tween.stopAllByTarget(op);
                    tween(op)
                        .to(0.22, { opacity: 0 })
                        .call(() => {
                            if (this._bannerTimer <= 0 && this.waveBannerNode && this.waveBannerNode.isValid) {
                                this.waveBannerNode.active = false;
                            }
                        })
                        .start();
                } else {
                    this.waveBannerNode.active = false;
                }
            }
        }

        if (this.alertLabel && this.alertLabel.node.active && this._isBeingStolen) {
            this._pulsePhase += dt * 9.0;
            const s = 1.0 + Math.sin(this._pulsePhase) * 0.06;
            this.alertLabel.node.setScale(s, s, 1);
        }
    }
}
