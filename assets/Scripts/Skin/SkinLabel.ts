import { _decorator, Color, Component, Enum, Label, Vec2 } from 'cc';
import { palette, parseCss, SkinColor, SkinPalette } from './SkinPaint';

const { ccclass, property, executeInEditMode, menu, requireComponent, disallowMultiple } = _decorator;

export enum SkinLabelPreset {
    /** Chữ trên nút: trắng, viền đậm theo màu nút, bóng đổ xuống */
    Button,
    /** Tiêu đề lớn: trắng, viền đậm dày, bóng đổ */
    Title,
    /** Tiêu đề vàng: chữ vàng, viền nâu */
    TitleGold,
    /** Chữ thường trên nền tối: trắng, viền mảnh */
    Body,
    /** Số trên thanh máu: trắng, viền đen mảnh, không bóng */
    Bar,
}
Enum(SkinLabelPreset);

const _color = new Color();

function css(out: Color, value: string): Color {
    const [r, g, b, a] = parseCss(value);
    return out.set(r, g, b, a);
}

/**
 * Đổi style chữ của Label về chung kiểu với nút PLAY NOW (font chữ đậm tròn, trắng, viền đậm).
 * Font là asset TTF gán sẵn trên Label; component này chỉ lo màu / viền / bóng.
 */
@ccclass('SkinLabel')
@executeInEditMode
@requireComponent(Label)
@disallowMultiple
@menu('UI/Skin/SkinLabel')
export class SkinLabel extends Component {
    @property({ type: SkinLabelPreset })
    public get preset(): SkinLabelPreset {
        return this._preset;
    }
    public set preset(v: SkinLabelPreset) {
        this._preset = v;
        this.applyNow();
    }

    @property({ type: SkinColor, tooltip: 'Màu viền chữ lấy theo bảng màu này (Button / Title)' })
    public get color(): SkinColor {
        return this._color;
    }
    public set color(v: SkinColor) {
        this._color = v;
        this.applyNow();
    }

    @property
    private _preset: SkinLabelPreset = SkinLabelPreset.Title;
    @property
    private _color: SkinColor = SkinColor.Green;

    protected onEnable() {
        this.applyNow();
    }

    public applyNow() {
        const label = this.getComponent(Label);
        if (label) SkinLabel.applyTo(label, this._preset, palette(this._color));
    }

    public static applyTo(label: Label, preset: SkinLabelPreset, pal: SkinPalette) {
        const size = label.fontSize || 40;
        label.isBold = false;
        label.enableOutline = true;

        switch (preset) {
            case SkinLabelPreset.Button:
                label.color = Color.WHITE;
                label.outlineColor = css(_color, pal.outline);
                label.outlineWidth = clamp(Math.round(size * 0.1), 2, 6);
                setShadow(label, pal.shadow, size * 0.09);
                break;
            case SkinLabelPreset.Title:
                label.color = Color.WHITE;
                label.outlineColor = css(_color, pal.outline);
                label.outlineWidth = clamp(Math.round(size * 0.1), 3, 8);
                setShadow(label, pal.shadow, size * 0.08);
                break;
            case SkinLabelPreset.TitleGold:
                label.color = css(_color, '#ffe066');
                label.outlineColor = css(_color, '#5c3504');
                label.outlineWidth = clamp(Math.round(size * 0.1), 3, 8);
                setShadow(label, 'rgba(60,30,0,0.8)', size * 0.08);
                break;
            case SkinLabelPreset.Body:
                label.color = Color.WHITE;
                label.outlineColor = css(_color, '#10151a');
                label.outlineWidth = clamp(Math.round(size * 0.08), 2, 4);
                label.enableShadow = false;
                break;
            case SkinLabelPreset.Bar:
                label.color = Color.WHITE;
                label.outlineColor = css(_color, '#0b0f0a');
                label.outlineWidth = clamp(Math.round(size * 0.12), 1, 4);
                label.enableShadow = false;
                break;
        }
    }
}

function setShadow(label: Label, color: string, drop: number) {
    label.enableShadow = true;
    label.shadowColor = css(_color, color);
    label.shadowOffset = new Vec2(0, -Math.max(2, Math.round(drop)));
    label.shadowBlur = 0;
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}
