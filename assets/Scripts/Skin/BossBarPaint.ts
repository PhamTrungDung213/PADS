/**
 * Vẽ bằng canvas 2D cho thanh máu boss kiểu "VIP": khung vàng, huy hiệu đầu lâu, băng rôn tên.
 * Dùng qua BossBarSkin (SkinBase), không cần ảnh.
 */

const GOLD_STOPS: [number, string][] = [[0, '#fff3b8'], [0.3, '#f5c84f'], [0.62, '#b47b1d'], [1, '#6a420e']];
const GOLD_DARK = '#3d2405';

function goldGradient(g: CanvasRenderingContext2D, y0: number, y1: number): CanvasGradient {
    const grad = g.createLinearGradient(0, y0, 0, y1);
    for (const [at, c] of GOLD_STOPS) grad.addColorStop(at, c);
    return grad;
}

/** Hình lục giác dẹt: thân chữ nhật, hai đầu vát nhọn (dài tip px). */
function hexBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tip: number) {
    g.beginPath();
    g.moveTo(x + tip, y);
    g.lineTo(x + w - tip, y);
    g.lineTo(x + w, y + h / 2);
    g.lineTo(x + w - tip, y + h);
    g.lineTo(x + tip, y + h);
    g.lineTo(x, y + h / 2);
    g.closePath();
}

function stud(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    g.fillStyle = GOLD_DARK;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    const grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 0.85);
    grad.addColorStop(0, '#fffbe0');
    grad.addColorStop(0.5, '#f0c04a');
    grad.addColorStop(1, '#8a5a12');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    g.fill();
}

/** Khung thanh máu: viền vàng hai đầu nhọn, lòng sắt tối, đinh tán ở hai đầu. */
export function paintBossFrame(g: CanvasRenderingContext2D, w: number, h: number) {
    const tip = h * 0.5;
    const b = Math.max(3, h * 0.13);

    // Bóng đổ dưới khung
    g.fillStyle = 'rgba(0,0,0,0.45)';
    hexBar(g, 0, h * 0.06, w, h * 0.94, tip);
    g.fill();

    // Viền ngoài tối + thân vàng
    g.fillStyle = GOLD_DARK;
    hexBar(g, 0, 0, w, h * 0.94, tip);
    g.fill();
    g.fillStyle = goldGradient(g, 0, h * 0.94);
    hexBar(g, 2, 2, w - 4, h * 0.94 - 4, tip - 1);
    g.fill();

    // Vệt sáng mép trên của viền vàng
    g.save();
    hexBar(g, 2, 2, w - 4, h * 0.94 - 4, tip - 1);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(0, 2, w, Math.max(1, h * 0.06));
    g.restore();

    // Lòng sắt tối
    const ih = h * 0.94 - b * 2;
    const iron = g.createLinearGradient(0, b, 0, b + ih);
    iron.addColorStop(0, '#120c0b');
    iron.addColorStop(0.5, '#2a1f1c');
    iron.addColorStop(1, '#0d0908');
    g.fillStyle = GOLD_DARK;
    hexBar(g, b - 1, b - 1, w - (b - 1) * 2, ih + 2, tip - b * 0.6);
    g.fill();
    g.fillStyle = iron;
    hexBar(g, b, b, w - b * 2, ih, tip - b * 0.6);
    g.fill();

    // Đinh tán ở hai mũi nhọn
    const r = Math.max(3, h * 0.11);
    stud(g, tip * 0.55, h * 0.47, r);
    stud(g, w - tip * 0.55, h * 0.47, r);
}

/** Huy hiệu tròn viền vàng, nền đỏ thẫm, đầu lâu trắng ngà; có 2 sừng nhọn phía trên. */
export function paintBossEmblem(g: CanvasRenderingContext2D, w: number, h: number) {
    const s = Math.min(w, h);
    const cx = w / 2;
    const cy = h / 2 + s * 0.05;
    const R = s * 0.42;

    // Sừng
    for (const d of [-1, 1]) {
        g.fillStyle = GOLD_DARK;
        g.beginPath();
        g.moveTo(cx + d * R * 0.35, cy - R * 0.75);
        g.quadraticCurveTo(cx + d * R * 0.95, cy - R * 1.05, cx + d * R * 1.05, cy - R * 1.22);
        g.quadraticCurveTo(cx + d * R * 0.95, cy - R * 0.6, cx + d * R * 0.75, cy - R * 0.45);
        g.closePath();
        g.fill();
        g.fillStyle = goldGradient(g, cy - R * 1.2, cy - R * 0.5);
        g.beginPath();
        g.moveTo(cx + d * R * 0.42, cy - R * 0.74);
        g.quadraticCurveTo(cx + d * R * 0.92, cy - R * 0.98, cx + d * R * 0.98, cy - R * 1.1);
        g.quadraticCurveTo(cx + d * R * 0.9, cy - R * 0.64, cx + d * R * 0.72, cy - R * 0.52);
        g.closePath();
        g.fill();
    }

    // Vòng ngoài vàng
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(cx, cy + s * 0.03, R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = GOLD_DARK;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = goldGradient(g, cy - R, cy + R);
    g.beginPath();
    g.arc(cx, cy, R - 2, 0, Math.PI * 2);
    g.fill();

    // Lòng đỏ thẫm
    const ri = R * 0.78;
    g.fillStyle = GOLD_DARK;
    g.beginPath();
    g.arc(cx, cy, ri + 1.5, 0, Math.PI * 2);
    g.fill();
    const core = g.createRadialGradient(cx, cy - ri * 0.3, ri * 0.1, cx, cy, ri);
    core.addColorStop(0, '#c4211c');
    core.addColorStop(0.7, '#6d0a0a');
    core.addColorStop(1, '#3a0404');
    g.fillStyle = core;
    g.beginPath();
    g.arc(cx, cy, ri, 0, Math.PI * 2);
    g.fill();

    // Đầu lâu
    const k = ri;
    const bone = '#f4ead2';
    const line = '#2a0a06';
    const skull = () => {
        g.beginPath();
        g.arc(cx, cy - k * 0.12, k * 0.5, Math.PI * 0.85, Math.PI * 2.15);
        g.lineTo(cx + k * 0.3, cy + k * 0.22);
        g.lineTo(cx + k * 0.3, cy + k * 0.48);
        g.lineTo(cx - k * 0.3, cy + k * 0.48);
        g.lineTo(cx - k * 0.3, cy + k * 0.22);
        g.closePath();
    };
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, k * 0.1);
    g.strokeStyle = line;
    skull();
    g.stroke();
    g.fillStyle = bone;
    skull();
    g.fill();

    g.fillStyle = line;
    for (const d of [-1, 1]) {
        g.beginPath();
        g.ellipse(cx + d * k * 0.2, cy - k * 0.08, k * 0.14, k * 0.16, 0, 0, Math.PI * 2);
        g.fill();
    }
    g.beginPath();
    g.moveTo(cx, cy + k * 0.08);
    g.lineTo(cx - k * 0.07, cy + k * 0.2);
    g.lineTo(cx + k * 0.07, cy + k * 0.2);
    g.closePath();
    g.fill();
    g.lineWidth = Math.max(1, k * 0.05);
    for (const d of [-0.15, 0, 0.15]) {
        g.beginPath();
        g.moveTo(cx + d * k, cy + k * 0.3);
        g.lineTo(cx + d * k, cy + k * 0.46);
        g.stroke();
    }

    // Vệt sáng trên vòng vàng
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = Math.max(1, R * 0.06);
    g.beginPath();
    g.arc(cx, cy, R - R * 0.09, Math.PI * 1.15, Math.PI * 1.55);
    g.stroke();
}

/** Băng rôn tên: nền đỏ thẫm, viền vàng, hai đầu cắt đuôi én. */
export function paintBossPlate(g: CanvasRenderingContext2D, w: number, h: number) {
    const notch = h * 0.32;
    const ribbon = (x: number, y: number, rw: number, rh: number, n: number) => {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + rw, y);
        g.lineTo(x + rw - n, y + rh / 2);
        g.lineTo(x + rw, y + rh);
        g.lineTo(x, y + rh);
        g.lineTo(x + n, y + rh / 2);
        g.closePath();
    };
    const bh = h * 0.92;
    const b = Math.max(3, h * 0.1);

    g.fillStyle = 'rgba(0,0,0,0.45)';
    ribbon(0, h - bh, w, bh, notch);
    g.fill();

    g.fillStyle = GOLD_DARK;
    ribbon(0, 0, w, bh, notch);
    g.fill();
    g.fillStyle = goldGradient(g, 0, bh);
    ribbon(2, 2, w - 4, bh - 4, notch - 1);
    g.fill();

    const red = g.createLinearGradient(0, b, 0, bh - b);
    red.addColorStop(0, '#d8312a');
    red.addColorStop(0.45, '#a3110f');
    red.addColorStop(1, '#5a0606');
    g.fillStyle = GOLD_DARK;
    ribbon(b - 1, b - 1, w - (b - 1) * 2, bh - (b - 1) * 2, notch - b * 0.3);
    g.fill();
    g.fillStyle = red;
    ribbon(b, b, w - b * 2, bh - b * 2, notch - b * 0.3);
    g.fill();

    // Dải bóng trên lòng đỏ
    g.save();
    ribbon(b, b, w - b * 2, bh - b * 2, notch - b * 0.3);
    g.clip();
    g.fillStyle = 'rgba(255,190,170,0.28)';
    g.fillRect(0, b, w, (bh - b * 2) * 0.32);
    g.restore();
}
