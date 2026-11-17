import { _decorator, Enum, SpriteFrame } from 'cc';
import { SkinBase } from './SkinBase';
import { paintBossEmblem, paintBossFrame, paintBossPlate } from './BossBarPaint';
import { SkinTexture } from './SkinTexture';

const { ccclass, property, executeInEditMode, menu, disallowMultiple } = _decorator;

export enum BossBarPart {
    /** Khung vàng bao quanh thanh máu */
    Frame,
    /** Huy hiệu đầu lâu đặt ở đầu trái thanh */
    Emblem,
    /** Băng rôn làm nền cho tên boss */
    Plate,
}
Enum(BossBarPart);

/** Các mảnh trang trí của thanh máu boss, vẽ bằng code theo đúng kích thước node. */
@ccclass('BossBarSkin')
@executeInEditMode
@disallowMultiple
@menu('UI/Skin/BossBarSkin')
export class BossBarSkin extends SkinBase {
    @property({ type: BossBarPart })
    public get part(): BossBarPart {
        return this._part;
    }
    public set part(v: BossBarPart) {
        this._part = v;
        this.redraw();
    }

    @property
    private _part: BossBarPart = BossBarPart.Frame;

    protected buildFrame(width: number, height: number): SpriteFrame {
        const part = this._part;
        const paint = part === BossBarPart.Emblem ? paintBossEmblem
            : part === BossBarPart.Plate ? paintBossPlate
                : paintBossFrame;
        return SkinTexture.frame(`boss:${part}`, width, height, paint);
    }
}
