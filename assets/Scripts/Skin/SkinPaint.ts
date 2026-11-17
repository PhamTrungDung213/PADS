import { Enum } from 'cc';

/**
 * Bộ vẽ UI bằng canvas 2D — không dùng sprite asset.
 * Style lấy theo nút "PLAY NOW": viền xanh đậm 1px, gờ 3D tối ở đáy, thân gradient,
 * dải bóng nhạt ở 30% trên cùng, vệt sáng trắng ở góc trên trái, chữ trắng viền đậm.
 * Mọi hàm ở đây là hàm thuần trên CanvasRenderingContext2D; SkinTexture lo đổi ra SpriteFrame.
 */

export enum SkinColor {
    Green,
    Orange,
    Red,
    Blue,
    Gold,
    Gray,
    Purple,
    Crimson,
}
Enum(SkinColor);

export interface SkinPalette {
    /** Gờ 3D ở đáy và viền ngoài */
    lip: string;
    /** Đầu gradient thân (mép trên) */
    top: string;
    /** Điểm giữa gradient (28% chiều cao) */
    mid: string;
    /** Cuối gradient thân (mép dưới) */
    bottom: string;
    /** Dải bóng nhạt phía trên */
    gloss: string;
    /** Vệt sáng trắng góc trên trái */
    glint: string;
    /** Viền chữ */
    outline: string;
    /** Bóng chữ (có alpha) */
    shadow: string;
}

export const PALETTES: Record<number, SkinPalette> = {
    [SkinColor.Green]: { lip: '#1f5e10', top: '#8ad937', mid: '#82d434', bottom: '#4eae21', gloss: '#b3e77d', glint: '#f3fbeb', outline: '#14320a', shadow: 'rgba(20,50,10,0.75)' },
    [SkinColor.Orange]: { lip: '#7a3205', top: '#ffc04a', mid: '#ffa72a', bottom: '#f07d12', gloss: '#ffd98c', glint: '#fff6e6', outline: '#5a2304', shadow: 'rgba(90,35,4,0.75)' },
    [SkinColor.Red]: { lip: '#6e1010', top: '#ff6b5a', mid: '#f2533f', bottom: '#cf2a1e', gloss: '#ff9e92', glint: '#fff0ee', outline: '#4a0909', shadow: 'rgba(74,9,9,0.75)' },
    [SkinColor.Blue]: { lip: '#123d78', top: '#5cc6ff', mid: '#41b0f5', bottom: '#1f84db', gloss: '#9ddcff', glint: '#eef9ff', outline: '#0b2850', shadow: 'rgba(11,40,80,0.75)' },
    [SkinColor.Gold]: { lip: '#7a4a05', top: '#ffe066', mid: '#ffd23f', bottom: '#f5a90f', gloss: '#fff0a8', glint: '#fffbea', outline: '#5c3504', shadow: 'rgba(92,53,4,0.75)' },
    [SkinColor.Gray]: { lip: '#3a3f46', top: '#b9c0c8', mid: '#a6aeb8', bottom: '#7f8893', gloss: '#d5dae0', glint: '#f6f7f8', outline: '#262a2f', shadow: 'rgba(38,42,47,0.75)' },
    [SkinColor.Purple]: { lip: '#3d1466', top: '#c58bff', mid: '#b06cf5', bottom: '#8540d6', gloss: '#dcb8ff', glint: '#f8f0ff', outline: '#2a0d47', shadow: 'rgba(42,13,71,0.75)' },
    [SkinColor.Crimson]: { lip: '#3f0404', top: '#ff5a46', mid: '#d81b16', bottom: '#7f0707', gloss: '#ff9d8f', glint: '#fff0ee', outline: '#300303', shadow: 'rgba(48,3,3,0.75)' },
};

export function palette(color: SkinColor): SkinPalette {
    return PALETTES[color] || PALETTES[SkinColor.Green];
}

/** '#rrggbb' / 'rgba(r,g,b,a)' -> [r,g,b,a] 0..255, để đổ sang cc.Color. */
export function parseCss(css: string): [number, number, number, number] {
    if (css[0] === '#') {
        const n = parseInt(css.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }
    const m = css.match(/[\d.]+/g) || [];
    const a = m.length > 3 ? Math.round(parseFloat(m[3]) * 255) : 255;
    return [+m[0] || 0, +m[1] || 0, +m[2] || 0, a];
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

export interface ButtonShape {
    /** Bán kính bo góc, px. <0 = tự tính theo chiều cao */
    radius: number;
    /** Gờ 3D ở đáy, px. <0 = tự tính */
    lip: number;
}

export function buttonLip(h: number, lip = -1): number {
    return lip >= 0 ? lip : Math.max(2, Math.round(h * 0.1));
}

/** Nút bóng như ảnh mẫu PLAY NOW. */
export function paintButton(g: CanvasRenderingContext2D, w: number, h: number, p: SkinPalette, shape: ButtonShape) {
    const r = shape.radius >= 0 ? shape.radius : Math.round(Math.min(h, w) * 0.22);
    const lip = buttonLip(h, shape.lip);
    const bw = Math.max(1, Math.round(h * 0.03));

    g.fillStyle = p.lip;
    roundRect(g, 0, 0, w, h, r);
    g.fill();

    const x0 = bw;
    const y0 = bw;
    const iw = w - bw * 2;
    const ih = h - lip - bw;
    const ir = Math.max(1, r - bw);
    const body = g.createLinearGradient(0, y0, 0, y0 + ih);
    body.addColorStop(0, p.top);
    body.addColorStop(0.28, p.mid);
    body.addColorStop(1, p.bottom);
    g.fillStyle = body;
    roundRect(g, x0, y0, iw, ih, ir);
    g.fill();

    g.save();
    roundRect(g, x0, y0, iw, ih, ir);
    g.clip();
    const gi = Math.max(2, Math.round(h * 0.05));
    g.globalAlpha = 0.9;
    g.fillStyle = p.gloss;
    roundRect(g, x0 + gi, y0 + gi * 0.6, iw - gi * 2, Math.round(ih * 0.3), Math.max(2, ir * 0.7));
    g.fill();
    g.globalAlpha = 1;
    const gl = Math.max(2, Math.round(h * 0.08));
    g.fillStyle = p.glint;
    roundRect(g, x0 + gi + gl * 0.4, y0 + gi * 0.6 + gl * 0.4, Math.max(gl * 2.2, iw * 0.06), gl, gl / 2);
    g.fill();
    g.restore();
}

export interface TrackStyle {
    radius: number;
    border: number;
    borderColor: string;
    inTop: string;
    inBottom: string;
}

export const DEFAULT_TRACK: TrackStyle = { radius: -1, border: -1, borderColor: '#14200f', inTop: '#20262b', inBottom: '#3a434b' };

/** Rãnh thanh máu / progress. */
export function paintTrack(g: CanvasRenderingContext2D, w: number, h: number, s: TrackStyle) {
    const r = s.radius >= 0 ? s.radius : h / 2;
    const bw = trackBorder(h, s.border);
    g.fillStyle = s.borderColor;
    roundRect(g, 0, 0, w, h, r);
    g.fill();
    const inner = g.createLinearGradient(0, bw, 0, h - bw);
    inner.addColorStop(0, s.inTop);
    inner.addColorStop(1, s.inBottom);
    g.fillStyle = inner;
    roundRect(g, bw, bw, w - bw * 2, h - bw * 2, Math.max(0, r - bw));
    g.fill();
}

export function trackBorder(h: number, border = -1): number {
    return border >= 0 ? border : Math.max(1, Math.round(h * 0.14));
}

/** Phần đổ đầy của thanh máu: gradient + vệt bóng + bóng tối ở đáy. */
export function paintFill(g: CanvasRenderingContext2D, w: number, h: number, p: SkinPalette, radius = -1) {
    const r = radius >= 0 ? radius : h / 2;
    const body = g.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, p.top);
    body.addColorStop(0.45, p.mid);
    body.addColorStop(1, p.bottom);
    g.fillStyle = body;
    roundRect(g, 0, 0, w, h, r);
    g.fill();

    g.save();
    roundRect(g, 0, 0, w, h, r);
    g.clip();
    const inset = Math.min(r, w / 4);
    g.globalAlpha = 0.85;
    g.fillStyle = p.gloss;
    roundRect(g, inset, h * 0.12, w - inset * 2, Math.max(1, h * 0.26), h * 0.13);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, h * 0.8, w, h * 0.2);
    g.restore();
}

export enum SkinPanelStyle {
    /** Khung viền màu + lòng tối */
    Panel,
    /** Chỉ có khung viền, lòng trong suốt (đặt lên ảnh) */
    Frame,
    /** Tấm bảng màu như thân nút, không có gờ — làm nền tiêu đề / tên */
    Plate,
    /** Nền phủ tối bo góc, không viền */
    Shade,
}
Enum(SkinPanelStyle);

export interface PanelStyle {
    style: SkinPanelStyle;
    radius: number;
    border: number;
    fillTop: string;
    fillBottom: string;
}

export function paintPanel(g: CanvasRenderingContext2D, w: number, h: number, p: SkinPalette, s: PanelStyle) {
    const r = s.radius;
    const bw = s.border;

    if (s.style === SkinPanelStyle.Shade) {
        const fill = g.createLinearGradient(0, 0, 0, h);
        fill.addColorStop(0, s.fillTop);
        fill.addColorStop(1, s.fillBottom);
        g.fillStyle = fill;
        roundRect(g, 0, 0, w, h, r);
        g.fill();
        return;
    }

    if (s.style === SkinPanelStyle.Plate) {
        paintButton(g, w, h, p, { radius: r, lip: Math.max(2, Math.round(h * 0.06)) });
        return;
    }

    g.fillStyle = p.outline;
    roundRect(g, 0, 0, w, h, r);
    g.fill();
    const border = g.createLinearGradient(0, 0, 0, h);
    border.addColorStop(0, p.top);
    border.addColorStop(1, p.bottom);
    g.fillStyle = border;
    roundRect(g, 2, 2, w - 4, h - 4, Math.max(0, r - 2));
    g.fill();

    g.save();
    roundRect(g, 2, 2, w - 4, h - 4, Math.max(0, r - 2));
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 2, w, Math.max(2, bw * 0.35));
    g.restore();

    const ix = 2 + bw;
    const iw = w - ix * 2;
    const ih = h - ix * 2;
    const ir = Math.max(2, r - bw - 2);
    if (s.style === SkinPanelStyle.Frame) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        roundRect(g, ix, ix, iw, ih, ir);
        g.fill();
        g.restore();
        g.strokeStyle = p.outline;
        g.lineWidth = 2;
        roundRect(g, ix - 1, ix - 1, iw + 2, ih + 2, ir + 1);
        g.stroke();
        return;
    }

    g.fillStyle = p.outline;
    roundRect(g, ix - 2, ix - 2, iw + 4, ih + 4, ir + 2);
    g.fill();
    const fill = g.createLinearGradient(0, ix, 0, ix + ih);
    fill.addColorStop(0, s.fillTop);
    fill.addColorStop(1, s.fillBottom);
    g.fillStyle = fill;
    roundRect(g, ix, ix, iw, ih, ir);
    g.fill();
}

export enum SkinGlyph {
    None,
    ArrowLeft,
    ArrowRight,
    Sword,
    Flag,
    SoundOn,
    SoundOff,
}
Enum(SkinGlyph);

/**
 * Icon trắng viền đậm vẽ thẳng lên texture nút (thay cho icon sprite).
 * (cx, cy) là tâm, size là cạnh ô vuông chứa icon, tính bằng px của canvas.
 */
export function paintGlyph(g: CanvasRenderingContext2D, glyph: SkinGlyph, cx: number, cy: number, size: number, p: SkinPalette) {
    if (glyph === SkinGlyph.None || size <= 2) return;
    const s = size / 2;
    const trace = () => {
        g.beginPath();
        switch (glyph) {
            case SkinGlyph.ArrowLeft:
            case SkinGlyph.ArrowRight: {
                const d = glyph === SkinGlyph.ArrowRight ? 1 : -1;
                g.moveTo(cx - s * 0.55 * d, cy - s * 0.8);
                g.lineTo(cx + s * 0.75 * d, cy);
                g.lineTo(cx - s * 0.55 * d, cy + s * 0.8);
                g.closePath();
                break;
            }
            case SkinGlyph.Sword: {
                // Lưỡi kiếm chéo 45°, mũi lên trên phải.
                g.save();
                g.translate(cx, cy);
                g.rotate(Math.PI / 4);
                const bw = s * 0.2;
                g.moveTo(0, -s * 0.95);
                g.lineTo(bw, -s * 0.72);
                g.lineTo(bw, s * 0.3);
                g.lineTo(s * 0.42, s * 0.3);
                g.lineTo(s * 0.42, s * 0.44);
                g.lineTo(bw * 0.7, s * 0.44);
                g.lineTo(bw * 0.7, s * 0.8);
                g.lineTo(bw * 1.1, s * 0.92);
                g.lineTo(-bw * 1.1, s * 0.92);
                g.lineTo(-bw * 0.7, s * 0.8);
                g.lineTo(-bw * 0.7, s * 0.44);
                g.lineTo(-s * 0.42, s * 0.44);
                g.lineTo(-s * 0.42, s * 0.3);
                g.lineTo(-bw, s * 0.3);
                g.lineTo(-bw, -s * 0.72);
                g.closePath();
                g.restore();
                break;
            }
            case SkinGlyph.Flag: {
                const x0 = cx - s * 0.55;
                g.rect(x0, cy - s * 0.9, s * 0.16, s * 1.8);
                g.moveTo(x0 + s * 0.16, cy - s * 0.85);
                g.bezierCurveTo(cx, cy - s * 1.1, cx + s * 0.2, cy - s * 0.55, cx + s * 0.7, cy - s * 0.75);
                g.lineTo(cx + s * 0.7, cy + s * 0.05);
                g.bezierCurveTo(cx + s * 0.2, cy + s * 0.25, cx, cy - s * 0.3, x0 + s * 0.16, cy - s * 0.05);
                g.closePath();
                break;
            }
            case SkinGlyph.SoundOn:
            case SkinGlyph.SoundOff: {
                // Loa: thân chữ nhật + loa kèn, lệch sang trái để chừa chỗ cho sóng âm / dấu X.
                const lx = cx - s * 0.3;
                g.moveTo(lx - s * 0.55, cy - s * 0.28);
                g.lineTo(lx - s * 0.15, cy - s * 0.28);
                g.lineTo(lx + s * 0.25, cy - s * 0.72);
                g.lineTo(lx + s * 0.25, cy + s * 0.72);
                g.lineTo(lx - s * 0.15, cy + s * 0.28);
                g.lineTo(lx - s * 0.55, cy + s * 0.28);
                g.closePath();

                if (glyph === SkinGlyph.SoundOn) {
                    // 2 vạch sóng âm: mỗi vạch là 1 cung tròn dày (vẽ kín để fill được).
                    const ox = lx + s * 0.3;
                    const a = Math.PI / 4;
                    for (const [r1, r2] of [[s * 0.28, s * 0.42], [s * 0.58, s * 0.72]]) {
                        g.moveTo(ox + r2 * Math.cos(-a), cy + r2 * Math.sin(-a));
                        g.arc(ox, cy, r2, -a, a);
                        g.arc(ox, cy, r1, a, -a, true);
                        g.closePath();
                    }
                } else {
                    // Dấu X bên phải loa.
                    const L = s * 0.32;
                    const t = s * 0.09;
                    g.save();
                    g.translate(cx + s * 0.5, cy);
                    g.rotate(Math.PI / 4);
                    g.rect(-L, -t, L * 2, t * 2);
                    g.rect(-t, -L, t * 2, L * 2);
                    g.restore();
                }
                break;
            }
        }
    };
    g.save();
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, size * 0.09);
    g.translate(0, Math.max(1, size * 0.05));
    trace();
    g.fillStyle = p.shadow;
    g.strokeStyle = p.shadow;
    g.stroke();
    g.fill();
    g.translate(0, -Math.max(1, size * 0.05));
    trace();
    g.strokeStyle = p.outline;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fill();
    g.restore();
}
