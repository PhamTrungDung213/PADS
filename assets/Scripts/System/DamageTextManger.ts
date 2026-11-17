import {
    _decorator,
    Camera,
    CCFloat,
    CCInteger,
    Color,
    Component,
    Enum,
    Font,
    instantiate,
    Label,
    Layers,
    Material,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
    warn,
} from 'cc';

const { ccclass, property } = _decorator;

export enum DamageTextKind {
    Normal = 0,
    Crit = 1,
    HeroHit = 2,
    Heal = 3,
}

@ccclass('DamageTextStyle')
export class DamageTextStyle {
    @property({ type: Enum(DamageTextKind) })
    public kind: DamageTextKind = DamageTextKind.Normal;

    @property
    public color: Color = new Color(255, 240, 150, 255);

    @property({ type: CCFloat })
    public sizeScale: number = 1.0;

    @property({ type: SpriteFrame })
    public icon: SpriteFrame = null;

    @property
    public prefix: string = '';

    @property({ type: Material })
    public material: Material = null;
}

class FloatingDamageTextItem {
    public node: Node = null;
    public label: Label = null;
    public icon: Sprite = null;
    public opacity: UIOpacity = null;
    public transform: UITransform = null;

    constructor(node: Node, label: Label, icon: Sprite, opacity: UIOpacity, transform: UITransform) {
        this.node = node;
        this.label = label;
        this.icon = icon;
        this.opacity = opacity;
        this.transform = transform;
    }

    public play(
        startPos: Vec3,
        text: string,
        color: Color,
        sizeScale: number,
        driftX: number,
        iconFrame: SpriteFrame,
        customMat: Material,
        onComplete: () => void,
    ) {
        // Dừng mọi tween cũ nếu item vừa lấy ra từ pool
        tween(this.node).stop();
        tween(this.opacity).stop();

        // 1. Cập nhật chuỗi và ép buộc render dữ liệu TRƯỚC KHI node active
        if (this.label) {
            // Đảm bảo không bao giờ là null/undefined hay rỗng
            const safeText = (text && text.trim().length > 0) ? text : '100';
            this.label.string = safeText;
            this.label.color = color;
            this.label.customMaterial = customMat || null;
            this.label.cacheMode = Label.CacheMode.CHAR;
            // Cho phép Cocos Creator gom ký tự vào dynamic atlas chung
            this.label.updateRenderData(false);
        }

        if (this.icon) {
            if (iconFrame) {
                this.icon.spriteFrame = iconFrame;
                this.icon.node.active = true;
            } else {
                this.icon.node.active = false;
            }
        }

        // 2. Định vị trí, tỉ lệ và bật active SAU KHI text đã sẵn sàng
        this.node.setPosition(startPos.x, startPos.y, 0);
        this.node.setScale(sizeScale * 0.7, sizeScale * 0.7, 1);
        this.opacity.opacity = 255;
        this.node.active = true;

        const targetY = startPos.y + 60;
        const targetX = startPos.x + driftX;

        // Hiệu ứng nảy số lên và mờ dần (Bounce & Fade Out) trong 0.6s
        tween(this.node)
            .to(0.12, { scale: new Vec3(sizeScale * 1.25, sizeScale * 1.25, 1) }, { easing: 'quadOut' })
            .to(0.1, { scale: new Vec3(sizeScale, sizeScale, 1) }, { easing: 'quadIn' })
            .start();

        tween(this.node)
            .to(0.6, { position: new Vec3(targetX, targetY, 0) }, { easing: 'sineOut' })
            .start();

        tween(this.opacity)
            .delay(0.35)
            .to(0.25, { opacity: 0 }, { easing: 'fade' })
            .call(() => {
                this.node.active = false;
                if (this.label) {
                    this.label.string = '';
                }
                onComplete();
            })
            .start();
    }
}

// Lưu ý: Giữ nguyên tên ccclass('DamgeText') để tương thích 100% với Scene
@ccclass('DamgeText')
export class DamageTextManager extends Component {
    public static instance: DamageTextManager = null;

    @property({ type: Prefab, tooltip: 'Prefab mẫu nếu có' })
    public textPrefab: Prefab = null;

    @property({ type: CCInteger, tooltip: 'Cỡ chữ mặc định của Fallback' })
    public fallbackFontSize: number = 36;

    @property({ type: Font, tooltip: 'Font chữ số sát thương' })
    public fallbackFont: Font = null;

    @property({ type: CCFloat, tooltip: 'Độ dày viền đen chữ' })
    public fallbackOutlineWidth: number = 4.0;

    @property({ type: Camera, tooltip: '3D Camera của thế giới (Main Camera)' })
    public worldCamera: Camera = null;

    @property({ type: Node, tooltip: 'Node cha chứa các chữ số (Canvas UI)' })
    public container: Node = null;

    @property({ type: CCFloat })
    public hitHeightMin: number = 0.8;

    @property({ type: CCFloat })
    public hitHeightMax: number = 1.6;

    @property({ type: CCFloat })
    public driftRange: number = 40.0;

    @property({ type: CCInteger, tooltip: 'Tối đa số lượng hiển thị cùng lúc để giữ 60 FPS' })
    public maxActive: number = 24;

    @property({ tooltip: 'Màu sát thương thường đánh quái' })
    public enemyHitColor: Color = new Color(255, 240, 150, 255);

    @property({ tooltip: 'Màu sát thương chí mạng' })
    public critColor: Color = new Color(255, 165, 0, 255);

    @property({ tooltip: 'Màu khi hero bị đánh' })
    public heroHitColor: Color = new Color(255, 90, 80, 255);

    @property({ type: [DamageTextStyle] })
    public styles: DamageTextStyle[] = [];

    @property({ type: Material, tooltip: 'Material chuyển sắc (DamageTextGradient.mtl)' })
    public gradientMaterial: Material = null;

    @property({ type: SpriteFrame, tooltip: 'Icon Crit.png' })
    public critIcon: SpriteFrame = null;

    private _pool: FloatingDamageTextItem[] = [];
    private _activeCount: number = 0;
    private _containerTransform: UITransform = null;
    private _worldPos: Vec3 = new Vec3();
    private _uiPos: Vec3 = new Vec3();

    onLoad() {
        DamageTextManager.instance = this;
        this.resolveReferences();
    }

    start() {
        this.resolveReferences();
        this.prewarmPool(15);
    }

    private prewarmPool(count: number = 15) {
        if (!this.container) return;
        while (this._pool.length < count) {
            const item = this.createFallbackItem();
            item.node.setParent(this.container);
            this._pool.push(item);
        }
    }

    private resolveReferences() {
        if (!this.worldCamera) {
            this.worldCamera = this.node.scene?.getChildByName('Main Camera')?.getComponent(Camera)
                || this.node.scene?.getComponentInChildren(Camera);
        }
        if (!this.container) {
            this.container = this.node.scene?.getChildByPath('UI/DamageText')
                || this.node.scene?.getChildByName('UI')
                || this.node;
        }
        if (this.container && !this._containerTransform) {
            this._containerTransform = this.container.getComponent(UITransform) || this.container.addComponent(UITransform);
        }
    }

    onDestroy() {
        if (DamageTextManager.instance === this) {
            DamageTextManager.instance = null;
        }
    }

    /**
     * Hàm chính: Hiển thị số sát thương (DisplayDamage = actualDamage * 100)
     */
    public showDamage(victimNode: Node, actualDamage: number, isCrit: boolean = false, attackerNode: Node = null) {
        if (!victimNode || !victimNode.isValid || actualDamage <= 0 || isNaN(actualDamage)) return;
        if (this._activeCount >= this.maxActive && actualDamage < 9000) return;

        this.resolveReferences();

        const cam = this.worldCamera;
        if (!cam || !cam.node) return;

        // Tính toán vị trí 3D trên đầu nạn nhân
        victimNode.getWorldPosition(this._worldPos);
        this._worldPos.y += this.hitHeightMin + Math.random() * (this.hitHeightMax - this.hitHeightMin);
        this._worldPos.x += (Math.random() * 2 - 1) * 0.35;
        this._worldPos.z += (Math.random() * 2 - 1) * 0.35;

        // Kiểm tra xem vị trí có nằm phía trước Camera không
        if (!this.isInFrontOf(cam, this._worldPos)) {
            if (actualDamage < 9000) return;
            // Với sát thương nổ toàn màn hình (Screen Clear), nếu quái hơi lệch góc cam thì kéo về trước cam
            const camPos = cam.node.worldPosition;
            const fwd = cam.node.forward;
            this._worldPos.set(camPos.x + fwd.x * 6 + (Math.random() * 2 - 1) * 2, 0.5, camPos.z + fwd.z * 6 + (Math.random() * 2 - 1) * 2);
        }

        // Chuyển từ toạ độ 3D sang toạ độ Canvas 2D
        cam.convertToUINode(this._worldPos, this.container, this._uiPos);
        this._uiPos.z = 0;

        // Công thức hiển thị sát thương: ActualDamage * 100
        const displayVal = Math.round(actualDamage * 100);
        if (isNaN(displayVal) || displayVal <= 0) return;
        const textStr = this.formatNumber(displayVal);

        const item = this.obtain();
        if (!item) return;

        const color = isCrit ? this.critColor : this.enemyHitColor;
        const sizeScale = isCrit ? 1.4 : 1.0;
        const drift = (Math.random() * 2 - 1) * this.driftRange;
        const icon = isCrit ? this.critIcon : null;
        const mat = isCrit ? this.gradientMaterial : null;

        const content = (isCrit ? 'CRIT! ' : '') + textStr;

        item.play(this._uiPos, content, color, sizeScale, drift, icon, mat, () => {
            this.recycle(item);
        });
    }

    private isInFrontOf(cam: Camera, pos: Vec3): boolean {
        const camPos = cam.node.worldPosition;
        const forward = cam.node.forward;
        const dx = pos.x - camPos.x;
        const dy = pos.y - camPos.y;
        const dz = pos.z - camPos.z;
        return dx * forward.x + dy * forward.y + dz * forward.z > 0.1;
    }

    private formatNumber(val: number): string {
        return val.toLocaleString();
    }

    private obtain(): FloatingDamageTextItem {
        let item = this._pool.pop();
        if (!item) {
            item = this.createFallbackItem();
        }
        item.node.active = false;
        item.node.setParent(this.container);
        this._activeCount++;
        return item;
    }

    private recycle(item: FloatingDamageTextItem) {
        if (!item || !item.node || !item.node.isValid) return;
        item.node.active = false;
        if (item.label) {
            item.label.string = '';
        }
        this._pool.push(item);
        this._activeCount = Math.max(0, this._activeCount - 1);
    }

    private createFallbackItem(): FloatingDamageTextItem {
        const node = new Node('DamageTextItem');
        node.layer = this.container ? this.container.layer : Layers.Enum.UI_2D;
        node.active = false;

        const transform = node.addComponent(UITransform);
        const opacity = node.addComponent(UIOpacity);

        const label = node.addComponent(Label);
        if (this.fallbackFont) label.font = this.fallbackFont;

        // Xóa hoàn toàn chữ "label" mặc định của Cocos Creator
        label.string = '';
        label.cacheMode = Label.CacheMode.CHAR;
        label.fontSize = this.fallbackFontSize;
        label.lineHeight = this.fallbackFontSize * 1.2;
        label.isBold = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.NONE;

        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 255);
        label.outlineWidth = this.fallbackOutlineWidth;

        // Node Icon nếu có
        const iconNode = new Node('Icon');
        iconNode.layer = node.layer;
        iconNode.setParent(node);
        iconNode.addComponent(UITransform).setContentSize(40, 40);
        iconNode.setPosition(-50, 20, 0);
        const iconSprite = iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        iconNode.active = false;

        return new FloatingDamageTextItem(node, label, iconSprite, opacity, transform);
    }
}
