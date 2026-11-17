import { _decorator, CCFloat, Enum, Sprite, SpriteFrame } from 'cc';
import { SkinBase } from './SkinBase';
import { DEFAULT_TRACK, paintFill, paintTrack, palette, SkinColor } from './SkinPaint';
import { SkinTexture } from './SkinTexture';

const { ccclass, property, executeInEditMode, menu, disallowMultiple } = _decorator;

export enum SkinBarPart {
    /** Rãnh nền: viền tối + lòng xám đậm */
    Track,
    /** Phần đổ đầy: gradient màu + vệt bóng */
    Fill,
}
Enum(SkinBarPart);

/**
 * Thanh máu / progress vẽ bằng code. Gắn Track lên node nền (thường là node có ProgressBar)
 * và Fill lên node ProgressBar.barSprite.
 *
 * Sprite FILLED giữ nguyên kiểu FILLED và vẽ đúng kích thước node; còn lại vẽ SLICED chỉ chia
 * ngang (bo hai đầu), nên ProgressBar kéo chiều rộng thì dùng lại được texture cũ.
 */
@ccclass('SkinBar')
@executeInEditMode
@disallowMultiple
@menu('UI/Skin/SkinBar')
export class SkinBar extends SkinBase {
    @property({ type: SkinBarPart })
    public get part(): SkinBarPart {
        return this._part;
    }
    public set part(v: SkinBarPart) {
        this._part = v;
        this.redraw();
    }

    @property({ type: SkinColor, visible(this: SkinBar) { return this._part === SkinBarPart.Fill; } })
    public get color(): SkinColor {
        return this._color;
    }
    public set color(v: SkinColor) {
        if (this._color === v) return;
        this._color = v;
        this.redraw();
    }

    @property({ type: CCFloat, tooltip: 'Bo góc (px). -1 = bo tròn hai đầu' })
    public get radius(): number {
        return this._radius;
    }
    public set radius(v: number) {
        this._radius = v;
        this.redraw();
    }

    @property
    private _part: SkinBarPart = SkinBarPart.Track;
    @property
    private _color: SkinColor = SkinColor.Green;
    @property
    private _radius: number = -1;

    protected get spriteType(): number {
        return Sprite.Type.SLICED;
    }

    private get filled(): boolean {
        const sprite = this.getComponent(Sprite);
        return !!sprite && sprite.type === Sprite.Type.FILLED;
    }

    protected buildFrame(width: number, height: number): SpriteFrame {
        const h = Math.max(2, Math.ceil(height));
        const r = this._radius >= 0 ? Math.min(this._radius, h / 2) : h / 2;
        const cap = Math.ceil(r) + 1;
        const exact = this.filled;
        const w = exact ? width : cap * 2 + 2;
        const insets = exact ? undefined : { left: cap, right: cap, top: 0, bottom: 0 };

        if (this._part === SkinBarPart.Track) {
            const style = { ...DEFAULT_TRACK, radius: r };
            return SkinTexture.frame(`track:${r}:${exact ? 'x' : 's'}`, w, h, (g, cw, ch) => paintTrack(g, cw, ch, style), insets);
        }
        const color = this._color;
        return SkinTexture.frame(`fill:${color}:${r}:${exact ? 'x' : 's'}`, w, h, (g, cw, ch) => paintFill(g, cw, ch, palette(color), r), insets);
    }
}
