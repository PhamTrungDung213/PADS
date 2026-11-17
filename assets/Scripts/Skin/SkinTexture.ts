import { ImageAsset, SpriteFrame, Texture2D } from 'cc';

export interface SkinInsets {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/**
 * Vẽ lên canvas 2D rồi đổi ra SpriteFrame, cache theo key (style + kích thước).
 * Texture sinh ra sống suốt đời game: số tổ hợp kích thước/màu trong một playable rất ít,
 * và scene đổi qua lại hub <-> level nên giữ lại còn đỡ vẽ lại.
 */
export class SkinTexture {
    private static _cache: Map<string, SpriteFrame> = new Map();

    public static get available(): boolean {
        return typeof document !== 'undefined' && !!document.createElement;
    }

    public static frame(
        key: string,
        width: number,
        height: number,
        paint: (g: CanvasRenderingContext2D, w: number, h: number) => void,
        insets?: SkinInsets,
    ): SpriteFrame {
        const w = Math.max(2, Math.ceil(width));
        const h = Math.max(2, Math.ceil(height));
        const full = `${key}|${w}x${h}`;
        const cached = this._cache.get(full);
        if (cached && cached.isValid) return cached;
        if (!this.available) return null;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext('2d');
        if (!g) return null;
        paint(g, w, h);

        const image = new ImageAsset(canvas);
        const texture = new Texture2D();
        texture.image = image;
        texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);

        const sf = new SpriteFrame();
        sf.texture = texture;
        sf.packable = false;
        if (insets) {
            sf.insetLeft = insets.left;
            sf.insetRight = insets.right;
            sf.insetTop = insets.top;
            sf.insetBottom = insets.bottom;
        }
        sf.addRef();
        this._cache.set(full, sf);
        return sf;
    }
}
