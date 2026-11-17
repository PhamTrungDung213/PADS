import { _decorator, CCObject, Component, Layout, Node, Sprite, SpriteFrame, UIRenderer, UITransform } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, executeInEditMode } = _decorator;

/**
 * Gốc chung cho các skin vẽ bằng code.
 *
 * Runtime: vẽ thẳng vào Sprite của chính node (thêm Sprite nếu node chưa có renderer nào),
 * để ProgressBar.barSprite / Button.target / Layout vẫn hoạt động như cũ.
 *
 * Editor: SpriteFrame sinh ra không có uuid nên không được ghi vào scene. Vì vậy ở editor
 * chỉ vẽ lên một node con ẩn, cờ DontSave, để nhìn trước trong Scene view. Node có Layout
 * thì bỏ qua xem trước (Layout sẽ xếp cả node con ẩn đó và làm lệch vị trí các node thật).
 */
@ccclass('SkinBase')
@executeInEditMode
export abstract class SkinBase extends Component {
    private _preview: Node = null;
    private _sprite: Sprite = null;

    protected abstract buildFrame(width: number, height: number): SpriteFrame;

    /** Sliced = kéo giãn theo insets, Simple = vẽ đúng kích thước node. */
    protected get spriteType(): number {
        return Sprite.Type.SIMPLE;
    }

    /**
     * Vẽ ngay từ pha preload (trước mọi onLoad), vì script ở node cha có thể đụng vào Sprite
     * trong onLoad của nó — vd. HpController set fillRange lên Sprite FILLED chưa có frame là lỗi.
     */
    protected __preload() {
        if (!EDITOR) this.redraw();
    }

    protected onEnable() {
        this.node.on(Node.EventType.SIZE_CHANGED, this.onResized, this);
        this.node.on(Node.EventType.ANCHOR_CHANGED, this.onResized, this);
        this.redraw();
    }

    protected onDisable() {
        this.node.off(Node.EventType.SIZE_CHANGED, this.onResized, this);
        this.node.off(Node.EventType.ANCHOR_CHANGED, this.onResized, this);
        if (this._preview?.isValid) this._preview.active = false;
    }

    protected onDestroy() {
        if (this._preview?.isValid) this._preview.destroy();
        this._preview = null;
    }

    private onResized() {
        this.redraw();
    }

    /** Vẽ lại theo kích thước hiện tại của node. Gọi khi đổi màu / style. */
    public redraw() {
        const ut = this.node.getComponent(UITransform);
        if (!ut) return;
        const sprite = this.resolveSprite(ut);
        if (!sprite) return;

        const frame = this.buildFrame(ut.width, ut.height);
        if (!frame) return;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sprite.type !== Sprite.Type.FILLED) sprite.type = this.spriteType;
        sprite.spriteFrame = frame;
    }

    private resolveSprite(ut: UITransform): Sprite {
        if (!EDITOR) {
            if (this._sprite?.isValid) return this._sprite;
            const own = this.node.getComponent(UIRenderer);
            if (own && !(own instanceof Sprite)) return this.previewSprite(ut);
            this._sprite = (own as Sprite) || this.node.addComponent(Sprite);
            return this._sprite;
        }
        if (this.node.getComponent(Layout)) return null;
        return this.previewSprite(ut);
    }

    private previewSprite(ut: UITransform): Sprite {
        let node = this._preview;
        if (!node || !node.isValid) {
            node = new Node('__skin');
            node._objFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy | CCObject.Flags.LockedInEditor;
            node.layer = this.node.layer;
            node.addComponent(UITransform);
            node.addComponent(Sprite);
            node.setParent(this.node);
            node.setSiblingIndex(0);
            this._preview = node;
        }
        node.active = true;
        const child = node.getComponent(UITransform);
        child.setContentSize(ut.contentSize);
        child.setAnchorPoint(ut.anchorPoint);
        node.setPosition(0, 0, 0);
        return node.getComponent(Sprite);
    }
}
