import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Color, Vec3, tween, Tween, Button, assetManager, UITransform } from 'cc';
import { SkillData } from '../Config/LevelUpConfig';
import { SkillReelView } from './SkillReelView';

const { ccclass, property } = _decorator;

@ccclass('SkillCardView')
export class SkillCardView extends Component {
    @property({ type: Sprite, tooltip: 'Card background sprite for level color tint (Green/Purple/Gold)' })
    public bgSprite: Sprite = null;

    @property({ type: Sprite, tooltip: 'Sprite displaying the skill icon' })
    public iconSprite: Sprite = null;

    @property({ type: SpriteFrame, tooltip: 'Green banner SpriteFrame (Level 1)' })
    public greenBannerFrame: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Purple banner SpriteFrame (Level 2)' })
    public purpleBannerFrame: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Gold banner SpriteFrame (Level 3)' })
    public goldBannerFrame: SpriteFrame = null;

    @property({ type: Label, tooltip: 'Skill title label' })
    public titleLabel: Label = null;

    @property({ type: Label, tooltip: 'Skill description label' })
    public descLabel: Label = null;

    @property({ type: SkillReelView, tooltip: 'Slot Reel roll component' })
    public reelView: SkillReelView = null;

    @property({ type: Node, tooltip: 'Node containing skill detail panel / content panel' })
    public contentPanel: Node = null;

    @property({ type: Node, tooltip: 'Banner node displayed after vertical flip' })
    public bannerNode: Node = null;

    @property({ type: Node, tooltip: 'Target node for spin flip (default: Icon_Skill or card root)' })
    public spinTarget: Node = null;

    @property({ tooltip: 'Automatically adapt color theme by level (Green/Purple/Gold)' })
    public autoColorByLevel: boolean = true;

    private static _cachedGreenFrame: SpriteFrame = null;
    private static _cachedPurpleFrame: SpriteFrame = null;
    private static _cachedGoldFrame: SpriteFrame = null;

    public currentSkill: SkillData = null;
    private _onClickCb: (skill: SkillData) => void = null;
    private _isInteractable: boolean = false;

    public get isInteractable(): boolean {
        return this._isInteractable;
    }

    private _baseScale: Vec3 = new Vec3(1, 1, 1);
    private _basePos: Vec3 = new Vec3(0, 0, 0);
    private _hasCachedBaseTransform: boolean = false;

    public get baseScale(): Vec3 {
        this.cacheBaseTransform();
        return this._baseScale;
    }

    public get basePos(): Vec3 {
        this.cacheBaseTransform();
        return this._basePos;
    }

    onLoad() {
        this.cacheBaseTransform();
        this.resolveCardReferences();
        this.preloadBannerFrames();
        if (this.iconSprite && this.iconSprite.isValid) {
            this.iconSprite.node.active = false;
        }
        this.node.on(Node.EventType.TOUCH_END, this.onClickCard, this);
        const btn = this.getComponent(Button);
        if (btn) {
            this.node.on(Button.EventType.CLICK, this.onClickCard, this);
        }
    }

    private preloadBannerFrames() {
        if (!SkillCardView._cachedGreenFrame) {
            assetManager.loadAny('37d8bbf1-13a8-42f8-884a-fa1715c6a5b6@f9941', (err, asset: SpriteFrame) => {
                if (!err && asset) SkillCardView._cachedGreenFrame = asset;
            });
        }
        if (!SkillCardView._cachedPurpleFrame) {
            assetManager.loadAny('c82301fa-4b8a-4952-b184-e437c95a25f1@f9941', (err, asset: SpriteFrame) => {
                if (!err && asset) SkillCardView._cachedPurpleFrame = asset;
            });
        }
        if (!SkillCardView._cachedGoldFrame) {
            assetManager.loadAny('d974128b-5c9b-4a63-c295-f548da6b36a2@f9941', (err, asset: SpriteFrame) => {
                if (!err && asset) SkillCardView._cachedGoldFrame = asset;
            });
        }
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onClickCard, this);
        const btn = this.getComponent(Button);
        if (btn) {
            this.node.off(Button.EventType.CLICK, this.onClickCard, this);
        }
    }

    public cacheBaseTransform() {
        if (!this._hasCachedBaseTransform) {
            this.node.getScale(this._baseScale);
            this.node.getPosition(this._basePos);
            // Fallback an toàn nếu scale bị 0
            if (this._baseScale.x === 0 || this._baseScale.y === 0) {
                this._baseScale.set(0.82, 0.82, 1);
            }
            this._hasCachedBaseTransform = true;
        }
    }

    /**
     * Khôi phục chính xác 100% tỉ lệ scale và vị trí ban đầu bạn đã cài đặt trong Scene/Inspector
     */
    public resetTransform() {
        this.cacheBaseTransform();
        this.node.setScale(this._baseScale);
        this.node.setPosition(this._basePos);
        this.node.setRotationFromEuler(0, 0, 0);

        const target = this.spinTarget || this.node.getChildByName('Icon_Skill') || this.node;
        if (target && target.isValid) {
            target.setRotationFromEuler(0, 0, 0);
        }
        if (this.iconSprite && this.iconSprite.isValid) {
            this.iconSprite.node.setScale(new Vec3(1, 1, 1));
        }
    }

    private resolveCardReferences() {
        if (!this.reelView) {
            this.reelView = this.getComponentInChildren(SkillReelView);
        }
        if (!this.iconSprite) {
            const stripNode = this.node.getChildByPath('Icon_Skill/Reel/Strip');
            if (stripNode) {
                this.iconSprite = stripNode.getComponent(Sprite) || stripNode.addComponent(Sprite);
                this.iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                const ut = stripNode.getComponent(UITransform);
                if (ut) {
                    ut.setContentSize(186, 186);
                }
            } else {
                const reelNode = this.node.getChildByPath('Icon_Skill/Reel') || this.node.getChildByName('Icon_Skill');
                if (reelNode) {
                    this.iconSprite = reelNode.getComponentInChildren(Sprite);
                }
            }
        }
        if (!this.bannerNode) {
            this.bannerNode = this.contentPanel
                || this.node.getChildByName('Skill_Panel')
                || this.node.getChildByName('Banner');
        }
        if (!this.contentPanel) {
            this.contentPanel = this.bannerNode;
        }
        if (!this.spinTarget) {
            this.spinTarget = this.node.getChildByName('Icon_Skill') || this.node;
        }
        if (!this.bgSprite) {
            this.bgSprite = this.node.getChildByName('Light_bg')?.getComponent(Sprite)
                || this.node.getChildByName('Light_bg')?.getComponentInChildren(Sprite)
                || this.getComponent(Sprite);
        }
        if (!this.titleLabel) {
            this.titleLabel = this.bannerNode?.getChildByName('Skill_Info')?.getChildByName('Name_Skill2')?.getComponent(Label)
                || this.node.getChildByName('Name_Skill')?.getComponent(Label)
                || this.getComponentInChildren(Label);
        }
        if (!this.descLabel) {
            this.descLabel = this.bannerNode?.getChildByName('Skill_Info')?.getChildByName('Info_Skill')?.getComponent(Label);
        }
    }

    public setup(skill: SkillData, level: number, onClick: (skill: SkillData) => void) {
        this.resolveCardReferences();
        this.currentSkill = skill;
        this._onClickCb = onClick;
        this._isInteractable = false;

        const btn = this.getComponent(Button);
        if (btn) {
            btn.interactable = false;
        }

        // Tự động đổi màu banner và toàn bộ hào quang nền theo cấp độ (Lv1 Xanh lá, Lv2 Tím, Lv3 Vàng)
        if (this.autoColorByLevel) {
            this.applyLevelColorTheme(level);
        }

        if (this.titleLabel && skill) {
            this.titleLabel.string = skill.name;
        }
        if (this.descLabel && skill) {
            this.descLabel.string = skill.desc;
        }

        // Gán icon kỹ năng vào thẻ bài (giữ ẩn, chờ xoay xong xuất hiện cùng lúc với banner)
        this.applySkillIcon(skill);
        if (this.iconSprite && this.iconSprite.isValid) {
            this.iconSprite.node.active = false;
        }
    }

    /**
     * Nạp trước spriteFrame cho icon kỹ năng (giữ nguyên trạng thái ẩn cho đến khi xoay xong)
     */
    public applySkillIcon(skill: SkillData) {
        if (!skill) return;
        this.resolveCardReferences();
        if (!this.iconSprite) return;

        if (skill.icon) {
            this.iconSprite.spriteFrame = skill.icon;
        } else if (skill.iconUuid) {
            assetManager.loadAny(skill.iconUuid, (err, sf: SpriteFrame) => {
                if (!err && sf) {
                    skill.icon = sf;
                    if (this.currentSkill === skill && this.iconSprite && this.iconSprite.isValid) {
                        this.iconSprite.spriteFrame = sf;
                    }
                }
            });
        }
    }

    /**
     * Đồng bộ màu sắc của Banner và toàn bộ dải ánh sáng nền thẻ bài theo cấp độ Level
     * Level 1: Xanh lá (Green)
     * Level 2: Tím hoàng gia (Royal Purple)
     * Level 3: Vàng kim thánh quang (Holy Gold)
     */
    public applyLevelColorTheme(level: number) {
        this.resolveCardReferences();

        // 1. Đổi SpriteFrame của Banner chính (Skill_Panel)
        const bannerSprite = this.bannerNode?.getComponent(Sprite);
        if (bannerSprite) {
            if (level === 1) {
                const sf = this.greenBannerFrame || SkillCardView._cachedGreenFrame;
                if (sf) bannerSprite.spriteFrame = sf;
            } else if (level === 2) {
                const sf = this.purpleBannerFrame || SkillCardView._cachedPurpleFrame;
                if (sf) bannerSprite.spriteFrame = sf;
            } else {
                const sf = this.goldBannerFrame || SkillCardView._cachedGoldFrame;
                if (sf) bannerSprite.spriteFrame = sf;
            }
        }

        // 2. Đổi màu ánh hào quang nền (Background Glow/Light) đồng bộ theo cấp độ
        const setNodeColor = (childPath: string, color: Color) => {
            const targetNode = this.node.getChildByPath(childPath);
            if (targetNode) {
                const sp = targetNode.getComponent(Sprite);
                if (sp) sp.color = color;
            }
        };

        if (level === 1) {
            // Level 1: Tông Xanh lá
            setNodeColor('Light_gradient/Light_Smooth', new Color(34, 255, 65, 70));
            setNodeColor('Light_gradient/glow', new Color(190, 255, 190, 80));
            setNodeColor('Light_bg', new Color(1, 255, 0, 120));
            setNodeColor('Light_bg/Light_bg1', new Color(1, 255, 0, 40));
            setNodeColor('Light_gradient_2', new Color(1, 255, 0, 45));
            setNodeColor('Light_gradient_2/glow', new Color(220, 255, 220, 70));
            setNodeColor('Star', new Color(210, 255, 190, 170));
            setNodeColor('Icon_Skill/Icon_OuterGlow', new Color(45, 255, 39, 255));
        } else if (level === 2) {
            // Level 2: Tông Tím hoàng gia (Royal Purple)
            setNodeColor('Light_gradient/Light_Smooth', new Color(180, 50, 255, 90));
            setNodeColor('Light_gradient/glow', new Color(220, 160, 255, 100));
            setNodeColor('Light_bg', new Color(170, 30, 255, 140));
            setNodeColor('Light_bg/Light_bg1', new Color(170, 30, 255, 50));
            setNodeColor('Light_gradient_2', new Color(170, 30, 255, 55));
            setNodeColor('Light_gradient_2/glow', new Color(230, 180, 255, 90));
            setNodeColor('Star', new Color(240, 190, 255, 190));
            setNodeColor('Icon_Skill/Icon_OuterGlow', new Color(200, 60, 255, 255));
        } else {
            // Level 3: Tông Vàng kim thánh quang (Holy Golden)
            setNodeColor('Light_gradient/Light_Smooth', new Color(255, 200, 30, 100));
            setNodeColor('Light_gradient/glow', new Color(255, 240, 170, 110));
            setNodeColor('Light_bg', new Color(255, 190, 0, 150));
            setNodeColor('Light_bg/Light_bg1', new Color(255, 190, 0, 60));
            setNodeColor('Light_gradient_2', new Color(255, 190, 0, 65));
            setNodeColor('Light_gradient_2/glow', new Color(255, 240, 180, 95));
            setNodeColor('Star', new Color(255, 245, 190, 210));
            setNodeColor('Icon_Skill/Icon_OuterGlow', new Color(255, 210, 20, 255));
        }
    }

    /**
     * Bắt đầu hiệu ứng xoay dọc 1 lát rồi hiển thị banner xanh
     */
    public startSpin(duration: number, onFinished?: () => void) {
        this.resolveCardReferences();
        this.cacheBaseTransform();

        // Khóa tương tác hoàn toàn khi đang xoay
        this._isInteractable = false;
        const btn = this.getComponent(Button);
        if (btn) {
            btn.interactable = false;
        }

        // Ẩn cả banner và icon kỹ năng trong suốt thời gian xoay
        const banner = this.bannerNode || this.contentPanel;
        if (banner) {
            Tween.stopAllByTarget(banner);
            banner.active = false;
        }
        if (this.iconSprite && this.iconSprite.isValid) {
            Tween.stopAllByTarget(this.iconSprite.node);
            this.iconSprite.node.active = false;
            this.iconSprite.node.setPosition(0, 0, 0);
            this.iconSprite.node.setScale(new Vec3(0, 0, 1));
        }

        const spinDuration = duration > 0 ? duration : 0.8;
        const target = this.spinTarget || this.node.getChildByName('Icon_Skill') || this.node;
        if (target && target.isValid) {
            Tween.stopAllByTarget(target);
            target.setRotationFromEuler(0, 0, 0);
        }
        Tween.stopAllByTarget(this.node);

        // 1. Chạy hiệu ứng xoay dọc (Vertical 3D Spin Flip quanh trục X)
        const spinAnim = { angleX: 0 };
        const totalAngle = 720; // 2 vòng xoay dọc hoàn chỉnh

        tween(spinAnim)
            .to(spinDuration * 0.8, { angleX: totalAngle }, {
                easing: 'cubicOut',
                onUpdate: () => {
                    if (target && target.isValid) {
                        target.setRotationFromEuler(spinAnim.angleX, 0, 0);
                    }
                }
            })
            .call(() => {
                if (target && target.isValid) {
                    target.setRotationFromEuler(0, 0, 0);
                }

                // 2. Xoay xong -> Hiện banner VÀ icon cùng lúc với hiệu ứng bung mượt mà
                if (banner && banner.isValid) {
                    Tween.stopAllByTarget(banner);
                    banner.active = true;
                    banner.setScale(new Vec3(1, 0, 1));
                    tween(banner)
                        .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                        .start();
                }

                // Hiện icon kỹ năng xuất hiện đồng thời cùng lúc với banner (chỉ nảy phóng to, cố định tâm 0, 0, 0)
                if (this.iconSprite && this.iconSprite.isValid) {
                    Tween.stopAllByTarget(this.iconSprite.node);
                    this.iconSprite.node.setPosition(0, 0, 0);
                    this.iconSprite.node.setScale(new Vec3(0, 0, 1));
                    this.iconSprite.node.active = true;
                    tween(this.iconSprite.node)
                        .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                        .start();
                }

                // 3. Nảy nhẹ thẻ bài (bảo toàn tỉ lệ gốc)
                this.playBounce();
            })
            // Đợi banner bung xong hoàn toàn (0.25s) và âm thanh kết thúc trọn vẹn
            .delay(0.28)
            .call(() => {
                this._isInteractable = true;
                const b = this.getComponent(Button);
                if (b) {
                    b.interactable = true;
                }

                if (onFinished) {
                    onFinished();
                }
            })
            .start();

        // Đồng thời kích hoạt reelView cuộn icon bên trong nếu có
        if (this.reelView) {
            this.reelView.spin(spinDuration * 0.8, this.currentSkill);
        }
    }

    /**
     * Hiệu ứng nảy thẻ bài lên sau khi xoay xong
     * Giữ nguyên 100% tỉ lệ scale gốc người dùng đã chỉnh trong Scene, không bị biến dạng
     */
    public playBounce() {
        this.cacheBaseTransform();
        const bounceScale = this._baseScale.clone().multiplyScalar(1.1);

        tween(this.node)
            .to(0.14, { scale: bounceScale }, { easing: 'backOut' })
            .to(0.1, { scale: this._baseScale }, { easing: 'quadIn' })
            .start();
    }

    private onClickCard() {
        // Tuyệt đối không cho chọn, không cho nhấn khi chưa hiện xong hoặc chưa hết audio
        if (!this._isInteractable) {
            return;
        }

        if (this._onClickCb && this.currentSkill) {
            this._onClickCb(this.currentSkill);
        }
    }
}
