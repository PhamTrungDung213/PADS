import { _decorator, Button, CCFloat, Label, Node, SpriteFrame } from 'cc';
import { SkinBase } from './SkinBase';
import { SkinLabel, SkinLabelPreset } from './SkinLabel';
import { buttonLip, paintButton, paintGlyph, palette, SkinColor, SkinGlyph } from './SkinPaint';
import { SkinTexture } from './SkinTexture';

const { ccclass, property, executeInEditMode, menu, disallowMultiple } = _decorator;

/**
 * Nút kiểu "PLAY NOW" vẽ bằng code. Gắn lên node có Button; nền vẽ theo đúng kích thước node,
 * mọi Label con (trừ Label đã có SkinLabel riêng) được đổi sang chữ trắng viền đậm theo màu nút.
 * Icon con (Sprite) giữ nguyên. Button chuyển sang transition SCALE; khi interactable = false
 * thì vẽ màu xám.
 */
@ccclass('SkinButton')
@executeInEditMode
@disallowMultiple
@menu('UI/Skin/SkinButton')
export class SkinButton extends SkinBase {
    @property({ type: SkinColor })
    public get color(): SkinColor {
        return this._color;
    }
    public set color(v: SkinColor) {
        if (this._color === v) return;
        this._color = v;
        this.refresh();
    }

    @property({ type: CCFloat, tooltip: 'Bo góc (px). -1 = 22% cạnh ngắn' })
    public get radius(): number {
        return this._radius;
    }
    public set radius(v: number) {
        this._radius = v;
        this.refresh();
    }

    @property({ type: CCFloat, tooltip: 'Gờ 3D ở đáy (px). -1 = 10% chiều cao' })
    public get lip(): number {
        return this._lip;
    }
    public set lip(v: number) {
        this._lip = v;
        this.refresh();
    }

    @property({ tooltip: 'Đổi style mọi Label con sang chữ trắng viền theo màu nút' })
    public get styleLabels(): boolean {
        return this._styleLabels;
    }
    public set styleLabels(v: boolean) {
        this._styleLabels = v;
        this.refresh();
    }

    @property({ type: SkinGlyph, tooltip: 'Icon vẽ bằng code lên nút (thay icon sprite)' })
    public get glyph(): SkinGlyph {
        return this._glyph;
    }
    public set glyph(v: SkinGlyph) {
        this._glyph = v;
        this.refresh();
    }

    @property({ type: CCFloat, tooltip: 'Cỡ icon theo cạnh ngắn của thân nút (0..1)', visible(this: SkinButton) { return this._glyph !== SkinGlyph.None; } })
    public get glyphScale(): number {
        return this._glyphScale;
    }
    public set glyphScale(v: number) {
        this._glyphScale = v;
        this.refresh();
    }

    @property({ type: CCFloat, tooltip: 'Lệch tâm icon theo chiều dọc, tính theo chiều cao thân nút (+ = lên trên)', visible(this: SkinButton) { return this._glyph !== SkinGlyph.None; } })
    public get glyphY(): number {
        return this._glyphY;
    }
    public set glyphY(v: number) {
        this._glyphY = v;
        this.refresh();
    }

    @property
    private _color: SkinColor = SkinColor.Green;
    @property
    private _glyph: SkinGlyph = SkinGlyph.None;
    @property
    private _glyphScale: number = 0.6;
    @property
    private _glyphY: number = 0;
    @property
    private _radius: number = -1;
    @property
    private _lip: number = -1;
    @property
    private _styleLabels: boolean = true;

    private _interactable: boolean = true;

    protected onLoad() {
        const button = this.getComponent(Button);
        if (button) {
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 0.92;
            button.duration = 0.08;
            this._interactable = button.interactable;
        }
    }

    protected onEnable() {
        super.onEnable();
        this.applyLabels();
    }

    protected update() {
        const button = this.getComponent(Button);
        if (!button || button.interactable === this._interactable) return;
        this._interactable = button.interactable;
        this.refresh();
    }

    public refresh() {
        if (!this.enabledInHierarchy) return;
        this.redraw();
        this.applyLabels();
    }

    private get drawColor(): SkinColor {
        return this._interactable ? this._color : SkinColor.Gray;
    }

    protected buildFrame(width: number, height: number): SpriteFrame {
        const color = this.drawColor;
        const shape = { radius: this._radius, lip: this._lip };
        const glyph = this._glyph;
        const glyphScale = this._glyphScale;
        const glyphY = this._glyphY;
        const key = `btn:${color}:${this._radius}:${this._lip}:${glyph}:${glyphScale}:${glyphY}`;
        return SkinTexture.frame(key, width, height, (g, w, h) => {
            const pal = palette(color);
            paintButton(g, w, h, pal, shape);
            const body = h - buttonLip(h, shape.lip);
            paintGlyph(g, glyph, w / 2, body / 2 - glyphY * body, Math.min(w, body) * glyphScale, pal);
        });
    }

    private applyLabels() {
        if (!this._styleLabels) return;
        const labels = this.node.getComponentsInChildren(Label);
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (label.getComponent(SkinLabel)) continue;
            if (this.ownedByOtherButton(label.node)) continue;
            SkinLabel.applyTo(label, SkinLabelPreset.Button, palette(this.drawColor));
        }
    }

    private ownedByOtherButton(node: Node): boolean {
        for (let n = node; n && n !== this.node; n = n.parent) {
            if (n.getComponent(SkinButton)) return true;
        }
        return false;
    }
}
