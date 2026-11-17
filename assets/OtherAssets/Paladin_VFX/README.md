# Hiệu ứng bản Paladin (playable ADHD Squad, demo A)

Gói này có toàn bộ hiệu ứng đang dùng trong bản Paladin. Project gốc dùng Cocos Creator 3.8.4.

## Trong gói có gì

| Thư mục | Nội dung |
|---|---|
| `assets/` | 9 prefab VFX + 2 material vòng/vệt sáng, kèm đủ texture, material, mesh, shader (`.effect`) và 5 script component mà prefab cần (`Shared/vfx/scripts`). Có sẵn file `.meta`. |
| `_code_tham_khao/` | Code vẽ hiệu ứng bằng code và code gọi hiệu ứng theo từng skill. Chỉ để đọc, **không** chép vào `assets/` (sẽ báo lỗi thiếu file vì code này còn phụ thuộc gameplay). |
| `_anh_preview/` | Ảnh chụp từng skill đang chạy trong game, để xem hiện tại trông thế nào. |

## Cách mở

1. Chép nguyên thư mục `assets/` đè vào thư mục `assets/` của một project Cocos Creator 3.8.x. Giữ nguyên đường dẫn và **giữ file `.meta`**. `.meta` giữ UUID, mất nó thì prefab mất liên kết tới material/texture.
2. Mở project, chờ import xong.
3. Kéo prefab vào một scene 3D bất kỳ để xem.

## Hiệu ứng nào dùng cho skill nào

Con Paladin có đòn đập sách thường, popup 1 chọn 1 aura, popup 2 chọn 1 nâng cấp, popup 3 là chiêu clear màn.

| Prefab | Dùng ở đâu |
|---|---|
| `Shared/vfx/Mage/FX_FireBolt_impact` | Tia nhỏ khi đòn đập sách trúng quái (tối đa 3 quái mỗi đòn) |
| `Shared/vfx/Mage/FX_Lightning_Blue` | **Aura of Thunder**: sét đánh xuống quái trong aura; cũng bật lúc vừa chọn aura này |
| `Shared/Common/FX_Lighting_Explosion` | **Bonk**: nổ vàng khi làm choáng; **Protective Aura**: khi hất văng từ 2 quái trở lên; chiêu **Holy Pillar** (tâm + từng quái), **Judgement** (tâm) |
| `Shared/vfx/Mage/FX_Fireball_impact` | **Aura of Sun**: bùng nắng trên quái; chiêu **Radiance**: vòng 8 vụ nổ quanh hero + trên quái |
| `Shared/vfx/Mage/FX_Burn` | **Burn Burn Burn**: lửa bám trên người quái đang cháy (tối đa 8 quái có lửa cùng lúc) |
| `Shared/vfx/Mage/FX_FireInferno_impact` | Lúc chọn **Burn Burn Burn**; Aura of Sun + Burn bùng trên quái; chiêu **Radiance** |
| `Shared/Common/FX_StarCombo_Full` | Vòm vàng: lúc chọn **Protective Aura** (bám theo hero); chiêu **Radiance** (lúc gồng + nổ ở tâm); chiêu **Holy Pillar** (tâm) |
| `Necropolis/vfx/prefab vfx/FX_LevelUp` | Cột sáng: lúc chọn **Righteous Fury**; lúc gồng mọi chiêu cuối; **Holy Pillar** (cột lớn, phóng to 2,6 lần); **Judgement** (cột sáng giáng trên từng quái) |
| `Shared/Common/FX_Fire_Explosion` | Chiêu **Radiance**: nổ lớn ở tâm |

Hai material dưới đây không phải prefab, mà được code dùng để tự dựng hình:

| Material | Dùng để vẽ |
|---|---|
| `Warrior/Materials/WA_Ring.mtl` | Vòng aura quanh chân hero (vẽ liên tục), vòng sóng toả ra mỗi nhịp aura, sóng lan khắp map ở chiêu cuối, vòng choáng trên đầu quái |
| `Warrior/Materials/WA_Swoosh.mtl` | Vệt quạt của đòn đập sách, tia sáng toả ra, vết nứt mặt đất |

## Hiệu ứng vẽ bằng code (xem `_code_tham_khao/`)

- `WA_GroundFx.ts`: có 3 kiểu hình vòng (`ring`), vệt chém (`swoosh`), tia/vết nứt toả ra (`streaks`). Đây là mesh dựng bằng code, màu và kích thước truyền vào lúc gọi.
- `WA_ScreenFx.ts`: chớp màn hình (`WA_ScreenFlash`) và rung camera (`WA_CameraShake`).
- `PA_PaladinCombat.ts`: chỗ gọi tất cả hiệu ứng theo từng skill: màu từng aura (hằng số `C_THUNDER`, `C_SUN`, `C_PROTECT`, `C_FIRE`…), độ phóng to và thời gian sống của từng prefab. Tìm `WA_GroundFx.prefab(this.fx.<tên>, vị trí, scale, thời gian sống)` để thấy prefab nào bật ở đâu.

## Lưu ý khi làm lại hiệu ứng

- Đây là **playable ad**: cả game phải gói trong 1 file HTML vài MB. Texture nên nhỏ (≤ 256px nếu được), ít material, ít particle.
- Game giới hạn **tối đa 36 prefab VFX sống cùng lúc**, vượt quá thì cái mới bị bỏ qua. Hiệu ứng nên ngắn (≤ 1–2 giây) và tự tắt.
- Nhiều skill bắn hiệu ứng trên nhiều quái cùng lúc (20–30 quái trên màn), nên hiệu ứng trên quái phải nhẹ.
- `FX_Burn` hiện có khói đen, khi nhiều quái cháy cùng lúc nhìn khá bẩn, nên làm lại cho sạch hơn.
- Prefab mới nên giữ quy ước: gốc prefab đặt ở mặt đất, hướng lên trục Y, cỡ khoảng 1–2m ở scale 1. Code tự phóng to khi cần.
- Làm xong, gửi lại prefab (kèm `.meta`). Bên mình sẽ gắn vào component `PA_PaladinCombat` trên prefab `PA_Paladin`, mục **Fx**.
