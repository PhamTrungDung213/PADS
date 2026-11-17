import { _decorator, CCFloat, Color, Sprite, SpriteFrame } from 'cc';
import { SkinBase } from './SkinBase';
import { paintPanel, palette, SkinColor, SkinPanelStyle } from './SkinPaint';
import { SkinTexture } from './SkinTexture';

const { ccclass, property, executeInEditMode, menu, disallowMultiple } = _decorator;

function hex(c: Color): string {
    return `rgba(${c.r},${c.g},${c.b},${(c.a / 255).toFixed(3)})`;
}

/**
 * Khung / panel / tấm tiêu đề vẽ bằng code, cùng ngôn ngữ hình với nút PLAY NOW.
 * - Panel: viền màu + lòng tối (popup, card)
 * - Frame: chỉ viền, lòng trong suốt (khung ảnh)
 * - Plate: tấm màu như thân nút (nền tên / tiêu đề)
 * - Shade: nền phủ tối bo góc
 */
@ccclass('SkinPanel')
@executeInEditMode
@disallowMultiple
@menu('UI/Skin/SkinPanel')
export class SkinPanel extends SkinBase {
    @property({ type: SkinPanelStyle })
    public get style(): SkinPanelStyle {
        return this._style;
    }
    public set style(v: SkinPanelStyle) {
        this._style = v;
        this.redraw();
    }

    @property({ type: SkinColor })
    public get color(): SkinColor {
        return this._color;
    }
    public set color(v: SkinColor) {
        if (this._color === v) return;
        this._color = v;
        this.redraw();
    }

    @property({ type: CCFloat, tooltip: 'Bo góc (px)' })
    public get radius(): number {
        return this._radius;
    }
    public set radius(v: number) {
        this._radius = v;
        this.redraw();
    }

    @property({ type: CCFloat, tooltip: 'Độ dày viền màu (px)' })
    public get border(): number {
        return this._border;
    }
    public set border(v: number) {
        this._border = v;
        this.redraw();
    }

    @property({ tooltip: 'Màu lòng panel, mép trên (Panel / Shade)' })
    public get fillTop(): Color {
        return this._fillTop;
    }
    public set fillTop(v: Color) {
        this._fillTop = v.clone();
        this.redraw();
    }

    @property({ tooltip: 'Màu lòng panel, mép dưới (Panel / Shade)' })
    public get fillBottom(): Color {
        return this._fillBottom;
    }
    public set fillBottom(v: Color) {
        this._fillBottom = v.clone();
        this.redraw();
    }

    @property
    private _style: SkinPanelStyle = SkinPanelStyle.Panel;
    @property
    private _color: SkinColor = SkinColor.Green;
    @property
    private _radius: number = 28;
    @property
    private _border: number = 8;
    @property
    private _fillTop: Color = new Color(43, 58, 74, 255);
    @property
    private _fillBottom: Color = new Color(26, 35, 48, 255);

    /** Plate vẽ đúng kích thước (dải bóng theo % chiều cao); còn lại vẽ 9-slice nhỏ. */
    protected get spriteType(): number {
        return this._style === SkinPanelStyle.Plate ? Sprite.Type.SIMPLE : Sprite.Type.SLICED;
    }

    protected buildFrame(width: number, height: number): SpriteFrame {
        const style = {
            style: this._style,
            radius: this._radius,
            border: this._border,
            fillTop: hex(this._fillTop),
            fillBottom: hex(this._fillBottom),
        };
        const color = this._color;
        const key = `panel:${style.style}:${color}:${style.radius}:${style.border}:${style.fillTop}:${style.fillBottom}`;
        const paint = (g: CanvasRenderingContext2D, w: number, h: number) => paintPanel(g, w, h, palette(color), style);
        if (this._style === SkinPanelStyle.Plate) return SkinTexture.frame(key, width, height, paint);

        const cap = Math.ceil(Math.max(this._radius, 0) + Math.max(this._border, 0) + 4);
        const side = cap * 2 + 2;
        return SkinTexture.frame(key, side, side, paint, { left: cap, right: cap, top: cap, bottom: cap });
    }
}
