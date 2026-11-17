# Building Map: setup môi trường, ánh sáng và material (Cocos Creator 3.8.4)

Tài liệu này mô tả đầy đủ trạng thái hiện tại của scene Building Map (map cát, ốc đảo, cây cọ, nước) trong project `ADHD-PlayableAds`, để dựng lại y hệt trên máy khác hoặc nhờ AI khác làm theo. Mọi con số đều lấy từ scene và file đang chạy, không phải ước lượng.

Mục tiêu của setup: cho map trông giống bản gốc trong game Unity `DangerDungeon` (scene `Game_Building_Map`). Nghĩa là màu tươi, bề mặt matte (không bóng), và ánh sáng không phụ thuộc nhiều vào đèn của scene Cocos.

---

## 1. Tóm tắt nhanh (checklist)

1. Engine: **Cocos Creator 3.8.4**, render pipeline `custom-pipeline`, scene ở chế độ **HDR**.
2. Scene globals: Skybox **tắt**, Shadows **tắt**, Fog **tắt**, Tone Mapping = **DEFAULT (ACES)**.
3. Một đèn `DirectionalLight` tên `Main Light`: màu `(255, 250, 240)`, illuminance HDR **65000**, không đổ bóng.
4. Main Camera: **Orthographic**, Ortho Height **7.8**, góc nhìn `(-42.01, -45, 0)`.
5. Map dùng 2 effect tự viết (mục 6): `Lit_Environment_Advanced` và `Lit_Environment_Basic`. Hai effect này tái hiện đúng công thức shader Unity, nên **phần lớn "look" nằm trong effect và material, không nằm ở đèn**.
6. Material dùng các giá trị ở mục 5. Quan trọng nhất: `Smoothness = 0`, `Light Strength` theo từng material, và `Tint Color` của Oasis = `(0.236, 1.04, 0.0136)`.

---

## 2. Cấu trúc file

```
assets/Shared/BuildingMap/
  Building Map.glb                         # model toàn bộ map
  effects/
    Lit_Environment_Advanced_bb478bca.effect   # uuid 3a5949af-dbca-43fd-8a8a-c29468ff332e
    Lit_Environment_Basic_94aaa599.effect      # uuid 1ab52a40-c73d-4e4c-8e4e-b4c44a34455e
    Water_Orthor_01161926.effect               # uuid 22d5daee-8f02-47f0-8663-adec9d7ba1eb
  materials/
    M_Oasis_Dungeon_Easy_aa4a2a8b.mtl      # uuid 8b272658-eaee-4424-8448-fd51809fd50e
    M_CampfireCooking.mtl                  # uuid ffa4f085-4049-425e-84b8-638ae69a3dec
    M_CampfireCooking_Meal.mtl             # uuid b900cb18-bf89-40a6-8d40-66f677dc8e92
    M_Water_Buidling_0f20ddfe.mtl          # uuid aca926d3-0db7-4000-aee9-6d590a9cb7c4
  textures/
    T_Oasis_Dungeon_dif_a_1_d0446611.tga   # uuid 629d6b6e-...  (atlas chính của map, alpha = mask)
    T_RestroomCampfire_dif.png             # uuid 62ac4595-...
    T_Global_Color_rgb.png                 # uuid 4dfbf610-...
    water_surface_48620d2e.jpg             # uuid ccae0cd5-...
assets/TestNew/
  M_Dungeon_Color_f6886062.mtl             # uuid 5f1c15f5-0d53-4489-aa2d-c55f0eb05072 (cầu, thuyền)
```

Scene đang dùng map: `assets/Warrior/Scene/warrior.scene`. Đường dẫn node: `warrior > CombatScene > Environment > Building Map`, ở position `(0,0,0)`, rotation `(0,0,0)`, scale `(1,1,1)`.

---

## 3. Scene globals (Scene node → Inspector)

| Mục | Giá trị |
|---|---|
| HDR | Bật (Skybox `useHDR = true`) |
| Ambient Sky Color (HDR) | `(0.20, 0.50, 0.80)`, Sky Illum **20000** |
| Ambient Ground Albedo (HDR) | `(0.20, 0.20, 0.20)` |
| Ambient (LDR, để tham khảo) | Sky `(0.45, 0.61, 0.76)`, Ground `(0.62, 0.58, 0.54)`, Illum 0.8 |
| Skybox | **Tắt**, không IBL, Env Lighting Type = 0 |
| Shadows | **Tắt** |
| Fog | **Tắt** |
| Post Settings → Tone Mapping | **0 = DEFAULT (ACES)** |
| Octree | Tắt |

Lưu ý: ambient xanh của scene **không ảnh hưởng tới map**. Effect của map đặt `Scene Ambient Weight = 0` và tự cộng ambient xám riêng (xem mục 6). Ambient này chỉ ảnh hưởng nhân vật và các object khác.

---

## 4. Đèn và camera

### Main Light (node `Lighting > Main Light`)
| Thuộc tính | Giá trị |
|---|---|
| Loại | DirectionalLight |
| Color | `rgba(255, 250, 240)` |
| Use Color Temperature | Tắt |
| Illuminance (HDR) | **65000** lux (LDR tương ứng 1.6927) |
| Shadow | Tắt |
| World rotation (euler) | `(-117.89, -52.61, 38.56)` |
| Hướng tới đèn (world) | ≈ `(0.41, 0.69, 0.59)`: góc chiếu xuống mặt đất ≈ 0.69, tương đương bản Unity (0.71) |

Với exposure của camera, cường độ đèn thực tế là 65000 × 2.604e-5 ≈ **1.69**. Model PBR của Cocos còn chia diffuse cho π nên ánh sáng trực tiếp còn ≈ **0.54**. Đây là lý do có thông số `Direct Light Scale` (mục 6).

### Main Camera (node `CombatScene > Main Camera`)
| Thuộc tính | Giá trị |
|---|---|
| Projection | **Ortho** (0), Ortho Height **7.8** |
| Near / Far | 0.01 / 1000 |
| World position | `(-6.83, 14.05, 9.53)` |
| Rotation (euler) | `(-42.01, -45.00, 0)` |
| Clear Flags | 14, clear color `(51, 51, 51)` |
| Aperture / Shutter / ISO (enum) | 19 / 7 / 0 (mặc định, exposure ≈ 2.604e-5) |

---

## 5. Material

| Material | Effect | Dùng cho | Texture | Giá trị khác mặc định |
|---|---|---|---|---|
| `M_Oasis_Dungeon_Easy` | Advanced | ~420 mesh: nền, đảo, bậc, cột, cỏ, sen, **cây cọ** | `T_Oasis_Dungeon_dif_a_1` | Defines: `USE_TWOSIDE`, `USE_INSTANCING`. Còn lại dùng mặc định của effect |
| `M_CampfireCooking` | Basic | `OrcFortress_Campfire*`, `Restroom_Campfire*` | `T_RestroomCampfire_dif` | `Light Strength` = 0.5 (bằng mặc định) |
| `M_CampfireCooking_Meal` | Basic | món ăn trên `Restroom_Campfire*` | (trắng) | `tintColor (0.43, 0.12, 0.003)`, **`lightStrength 1.0`** |
| `M_Dungeon_Color` | Basic | `SM_Building_feature_bridge`, `SM_Building_feature_Ship` | `T_Global_Color_rgb` | **`lightStrength 0.15`** |
| `M_Water_Buidling` | Water_Orthor | `Water_Plane`, `bridge nav*` | `water_surface` | `tilingOffset (12,12,0,0)`, `distortStrenght 0.15`, `stepIntersec 1`, `color1 (50,170,105)`, `color2 (15,125,70)` |

Gán material:
- Trong `Building Map.glb.meta`, sub-material của glb được **redirect** sang file `.mtl` ngoài: `M_Water_Buidling` → `aca926d3…`, `M_Oasis_Dungeon_Easy` → `8b272658…`, `M_Dungeon_Color` → `5f1c15f5…`.
- Hai material campfire được gán trực tiếp trên MeshRenderer trong scene (override của prefab instance), không qua redirect.

Giá trị `Light Strength` lấy thẳng từ `_Light_Strength` của material Unity: Oasis 0.7, Campfire 0.5, Meal 1.0, Dungeon_Color 0.15.

---

## 6. Effect: công thức và mã nguồn đầy đủ

### Vì sao không dùng effect chuẩn của Cocos

Shader gốc Unity (`Lit_Environment_*.shadergraph` + subgraph `Lit_Basic_WithAddShadow` / `LightBasicWithShadow`) **không phải PBR**. Đó là Lambert tự viết trên target Unlit:

```
albedo = BaseMap (sRGB→linear), vùng alpha >= 0.9 nhân thêm Tint (Color ID)
Final  = albedo × (Lambert(N·L) × mainLightColor + BakedGI)  +  albedo × _Light_Strength
```

- Không có specular, `_Smoothness = 0`, nên phải để matte.
- Hạng `albedo × _Light_Strength` là phần màu **cộng thẳng, không phụ thuộc ánh sáng**. Nó làm map trông tươi; thiếu nó map sẽ nhạt.
- Unity không chia π. Đèn Unity của scene `Game_Building_Map` có intensity 0.8, ambient Flat 0.449 (gamma), tức ≈ 0.17 linear.

Cách effect Cocos tái hiện công thức trên:
- **Base color** = `albedo × Direct Light Scale (1.48)`. Phần này đi qua đèn Cocos, và hệ số 1.48 bù cho việc Cocos chia π (0.54 × 1.48 ≈ 0.8).
- **Emissive** = `albedo × (Ambient Color 0.17 + Light Strength)`. Đây là ambient kiểu Unity cộng với phần màu không phụ thuộc ánh sáng.
- **Occlusion** = `Scene Ambient Weight (0)`. Cách này tắt ambient xanh của scene Cocos (AO trong Cocos chỉ nhân vào phần ánh sáng môi trường, không ảnh hưởng ánh sáng trực tiếp).
- **Roughness** = `1 − Smoothness` (= 1), specular 0.5. Với roughness 1 thì phần phản xạ gần như không thấy.

### Bảng thông số hiển thị trong Inspector

| Thông số | Advanced | Basic | Ý nghĩa |
|---|---|---|---|
| Tint Color | `(0.236, 1.04, 0.0136, 1)` | `(1,1,1,1)` | Màu "Color ID Easy" (linear). Ở Advanced chỉ áp lên texel có alpha ≥ 0.9, tức **lá cọ và lily pad**. |
| Smoothness | 0 | 0 | Độ bóng |
| Specular Intensity | 0.5 | 0.5 | Gần như không thấy khi smoothness = 0 |
| Direct Light Scale | 1.48 | 1.48 | Bù cho việc Cocos chia π |
| Scene Ambient Weight | 0 | 0 | 0 = bỏ ambient của scene Cocos |
| Ambient Color (linear) | `(0.17, 0.17, 0.17)` | `(0.17, 0.17, 0.17)` | Ambient kiểu Unity |
| Light Strength (unlit add) | 0.7 | 0.5 | `_Light_Strength` của Unity |

Cách tính `Tint Color` của Oasis: Unity lưu `_Easy = (0.758, 1.498, 0.153)`, tức màu chọn sRGB `(0.379, 0.749, 0.076)` × 2 (HDR intensity +1). Đổi màu chọn sang linear trước, rồi mới nhân 2. Nếu đổi thẳng cả giá trị HDR (`pow`), kênh xanh lá ra ≈ 2.5 và lá bị chói kiểu xanh nõn chuối.

### 6.1 `Lit_Environment_Advanced_bb478bca.effect`

```glsl
CCEffect %{
  techniques:
  - name: opaque
    passes:
    - vert: standard-vs
      frag: standard-fs
      rasterizerState:
        cullMode: none
      properties: &props
        tilingOffset:  { value: [1.0, 1.0, 0.0, 0.0] }
        mainTexture:  { value: grey, editor: { displayName: Base Map } }
        # Unity _Easy (0.758, 1.498, 0.153) = picked sRGB (0.379, 0.749, 0.076) x 2 (HDR intensity +1).
        # Linearize the base color, then apply the x2 in linear: pow()-ing the whole HDR value (2.5 green) made leaves glare.
        tintColor:  { value: [0.236, 1.04, 0.0136, 1.0], editor: { displayName: Tint Color (Color ID Easy, linear) } }
        # Unity source is Lambert-only (no specular, _Smoothness 0) -> keep matte by default.
        smoothness:  { value: 0.0, target: litParams.x, editor: { displayName: Smoothness, slide: true, range: [0, 1.0], step: 0.01 } }
        specularIntensity:  { value: 0.5, target: litParams.y, editor: { displayName: Specular Intensity, slide: true, range: [0, 1.0], step: 0.01 } }
        # Cocos diffuse is NoL*light/PI; Unity fake-lit is NoL*light with no PI (0.8 there vs ~0.54 here).
        brightness:  { value: 1.48, target: litParams.z, editor: { displayName: Direct Light Scale, slide: true, range: [0, 3.0], step: 0.01 } }
        # 0 = ignore the Cocos scene ambient (blue sky/ground hemisphere) and use Ambient Color below, like Unity.
        sceneAmbient:  { value: 0.0, target: litParams.w, editor: { displayName: Scene Ambient Weight, slide: true, range: [0, 1.0], step: 0.01 } }
        # Unity flat ambient 0.449 (gamma) -> ~0.17 linear.
        ambientColor:  { value: [0.17, 0.17, 0.17, 1.0], editor: { displayName: Ambient Color (linear) } }
        # Unity _Light_Strength: albedo * this is added as unlit emission (M_Oasis_Dungeon_Easy = 0.7).
        lightStrength:  { value: 0.7, target: emitParams.x, editor: { displayName: Light Strength (unlit add), slide: true, range: [0, 2.0], step: 0.01 } }
    - &shadow-caster
      vert: shadow-caster-vs
      frag: shadow-caster-fs
      phase: shadow-caster
      propertyIndex: 0
      rasterizerState:
        cullMode: front
}%

CCProgram shared-ubos %{
  uniform Constants {
    vec4 tilingOffset;
    vec4 tintColor;
    vec4 litParams;    // x: smoothness, y: specularIntensity, z: direct light scale, w: scene ambient weight
    vec4 ambientColor; // rgb: replacement ambient (Unity flat ambient)
    vec4 emitParams;   // x: Unity _Light_Strength
  };
}%

CCProgram macro-remapping %{
  #pragma define-meta USE_TWOSIDE
  #define CC_SURFACES_USE_TWO_SIDED USE_TWOSIDE
}%

CCProgram surface-vertex %{
  #define CC_SURFACES_VERTEX_MODIFY_UV
  void SurfacesVertexModifyUV(inout SurfacesStandardVertexIntermediate In)
  {
    In.texCoord = In.texCoord * tilingOffset.xy + tilingOffset.zw;
  }
}%

CCProgram surface-fragment %{
  uniform sampler2D mainTexture;

  vec4 SRGBToLinearTex(vec4 c) { return vec4(SRGBToLinear(c.rgb), c.a); }

  // Hand-written from the shader graph's DecodeAlphaMask / TintMaskColor nodes: the texture's
  // alpha is a mask (>= 0.9 means "tint this texel"). Fresnel (0.3-0.5) and emission (0.6-0.8)
  // mask bands are below the 0.61 clip / have black emission color on this material, so skipped.
  vec3 EnvAlbedo(vec4 tex)
  {
    vec3 base = SRGBToLinear(tex.rgb);
    return mix(base, base * tintColor.rgb, step(0.9, tex.a));
  }

  // Unity graph: Lit = albedo * (Lambert * mainLight + BakedGI) + albedo * _Light_Strength.
  // Direct part goes through Cocos lighting (scaled to undo the 1/PI); ambient + unlit add go to emissive.
  #define CC_SURFACES_FRAGMENT_MODIFY_BASECOLOR_AND_TRANSPARENCY
  vec4 SurfacesFragmentModifyBaseColorAndTransparency()
  {
    vec4 tex = texture(mainTexture, FSInput_texcoord);
    if (tex.a < 0.61) discard; // _AlphaClipping on the Unity material
    return vec4(EnvAlbedo(tex) * litParams.z, 1.0);
  }

  #define CC_SURFACES_FRAGMENT_MODIFY_EMISSIVE
  vec3 SurfacesFragmentModifyEmissive()
  {
    vec3 albedo = EnvAlbedo(texture(mainTexture, FSInput_texcoord));
    return albedo * (ambientColor.rgb + vec3(emitParams.x));
  }

  #define CC_SURFACES_FRAGMENT_MODIFY_PBRPARAMS
  vec4 SurfacesFragmentModifyPBRParams()
  {
    // x: occlusion (scales Cocos scene ambient only), y: roughness, z: metallic, w: specular
    return vec4(litParams.w, 1.0 - litParams.x, 0.0, litParams.y);
  }
}%

CCProgram standard-vs %{
  precision highp float;
  #include <macro-remapping>
  #include <surfaces/effect-macros/common-macros>
  #include <surfaces/includes/common-vs>
  #include <shared-ubos>
  #include <surface-vertex>
  #include <surfaces/includes/standard-vs>
  #include <shading-entries/main-functions/render-to-scene/vs>
}%

CCProgram standard-fs %{
  precision highp float;
  #include <macro-remapping>
  #include <surfaces/effect-macros/common-macros>
  #include <surfaces/includes/common-fs>
  #include <shared-ubos>
  #include <surface-fragment>
  #include <lighting-models/includes/standard>
  #include <surfaces/includes/standard-fs>
  #include <shading-entries/main-functions/render-to-scene/fs>
}%

CCProgram shadow-caster-vs %{
  precision highp float;
  #include <macro-remapping>
  #include <surfaces/effect-macros/render-to-shadowmap>
  #include <surfaces/includes/common-vs>
  #include <shared-ubos>
  #include <surface-vertex>
  #include <shading-entries/main-functions/render-to-shadowmap/vs>
}%

CCProgram shadow-caster-fs %{
  precision highp float;
  #include <macro-remapping>
  #include <surfaces/effect-macros/render-to-shadowmap>
  #include <surfaces/includes/common-fs>
  #include <shared-ubos>
  #include <surface-fragment>
  #include <shading-entries/main-functions/render-to-shadowmap/fs>
}%
```

### 6.2 `Lit_Environment_Basic_94aaa599.effect`

Giống Advanced, chỉ khác bốn điểm: không có alpha clip/mask, tint áp lên toàn bộ texel, `mainTexture` mặc định là `white`, `lightStrength` mặc định 0.5.

```glsl
CCEffect %{
  techniques:
  - name: opaque
    passes:
    - vert: standard-vs
      frag: standard-fs
      rasterizerState:
        cullMode: none
      properties: &props
        tilingOffset:  { value: [1.0, 1.0, 0.0, 0.0] }
        mainTexture:  { value: white, editor: { displayName: Base Map } }
        tintColor:  { value: [1.0, 1.0, 1.0, 1.0], editor: { displayName: Tint Color } }
        smoothness:  { value: 0.0, target: litParams.x, editor: { displayName: Smoothness, slide: true, range: [0, 1.0], step: 0.01 } }
        specularIntensity:  { value: 0.5, target: litParams.y, editor: { displayName: Specular Intensity, slide: true, range: [0, 1.0], step: 0.01 } }
        brightness:  { value: 1.48, target: litParams.z, editor: { displayName: Direct Light Scale, slide: true, range: [0, 3.0], step: 0.01 } }
        sceneAmbient:  { value: 0.0, target: litParams.w, editor: { displayName: Scene Ambient Weight, slide: true, range: [0, 1.0], step: 0.01 } }
        ambientColor:  { value: [0.17, 0.17, 0.17, 1.0], editor: { displayName: Ambient Color (linear) } }
        lightStrength:  { value: 0.5, target: emitParams.x, editor: { displayName: Light Strength (unlit add), slide: true, range: [0, 2.0], step: 0.01 } }
    - &shadow-caster
      vert: shadow-caster-vs
      frag: shadow-caster-fs
      phase: shadow-caster
      propertyIndex: 0
      rasterizerState:
        cullMode: front
}%

CCProgram shared-ubos %{
  uniform Constants {
    vec4 tilingOffset;
    vec4 tintColor;
    vec4 litParams;    // x: smoothness, y: specularIntensity, z: direct light scale, w: scene ambient weight
    vec4 ambientColor; // rgb: replacement ambient (Unity flat ambient)
    vec4 emitParams;   // x: Unity _Light_Strength
  };
}%

CCProgram macro-remapping %{
  #pragma define-meta USE_TWOSIDE
  #define CC_SURFACES_USE_TWO_SIDED USE_TWOSIDE
}%

CCProgram surface-vertex %{
  #define CC_SURFACES_VERTEX_MODIFY_UV
  void SurfacesVertexModifyUV(inout SurfacesStandardVertexIntermediate In)
  {
    In.texCoord = In.texCoord * tilingOffset.xy + tilingOffset.zw;
  }
}%

CCProgram surface-fragment %{
  uniform sampler2D mainTexture;

  vec4 SRGBToLinearTex(vec4 c) { return vec4(SRGBToLinear(c.rgb), c.a); }

  vec3 EnvAlbedo()
  {
    vec4 tex = SRGBToLinearTex(texture(mainTexture, FSInput_texcoord));
    return tex.rgb * tintColor.rgb;
  }

  #define CC_SURFACES_FRAGMENT_MODIFY_BASECOLOR_AND_TRANSPARENCY
  vec4 SurfacesFragmentModifyBaseColorAndTransparency()
  {
    return vec4(EnvAlbedo() * litParams.z, 1.0);
  }

  #define CC_SURFACES_FRAGMENT_MODIFY_EMISSIVE
  vec3 SurfacesFragmentModifyEmissive()
  {
    return EnvAlbedo() * (ambientColor.rgb + vec3(emitParams.x));
  }

  #define CC_SURFACES_FRAGMENT_MODIFY_PBRPARAMS
  vec4 SurfacesFragmentModifyPBRParams()
  {
    // x: occlusion (scales Cocos scene ambient only), y: roughness, z: metallic, w: specular
    return vec4(litParams.w, 1.0 - litParams.x, 0.0, litParams.y);
  }
}%

// standard-vs / standard-fs / shadow-caster-vs / shadow-caster-fs: giống hệt bản Advanced ở trên.
```

### 6.3 `Water_Orthor_01161926.effect` (unlit, viết tay, không đổi)

```glsl
CCEffect %{
  techniques:
  - name: opaque
    passes:
    - vert: water-vs:vert
      frag: water-fs:frag
      properties:
        tilingOffset:    { value: [1.0, 1.0, 0.0, 0.0] }
        params:          { value: [0.15, 0.0, 0.0, 0.0], editor: { visible: false } }
        mainTexture:     { value: grey, editor: { displayName: Foam Tex } }
        distortStrenght: { value: 0.15, target: params.x, editor: { displayName: distort strenght } }
        stepIntersec:    { value: 0, target: params.y, editor: { displayName: Step Intersec? } }
        color1:          { value: [0.0156, 0.7725, 0.4549, 1], editor: { displayName: Color1, type: color } }
        color2:          { value: [0.0, 0.5765, 0.1608, 1], editor: { displayName: Color2, type: color } }
}%

CCProgram water-ubo %{
  uniform Constants {
    vec4 tilingOffset;
    vec4 params;
    vec4 color1;
    vec4 color2;
  };
}%

CCProgram water-vs %{
  precision highp float;
  #include <legacy/input>
  #include <builtin/uniforms/cc-global>
  #include <legacy/decode-base>
  #include <legacy/local-batch>
  #include <water-ubo>

  out vec2 v_uv;

  vec4 vert () {
    vec4 position;
    CCVertInput(position);
    mat4 matWorld;
    CCGetWorldMatrix(matWorld);
    v_uv = a_texCoord * tilingOffset.xy + tilingOffset.zw;
    return cc_matProj * (cc_matView * matWorld) * position;
  }
}%

CCProgram water-fs %{
  precision highp float;
  #include <builtin/uniforms/cc-global>
  #include <legacy/output>
  #include <water-ubo>

  in vec2 v_uv;
  uniform sampler2D mainTexture;

  vec4 frag () {
    float t = cc_time.x;
    vec2 warp = (texture(mainTexture, v_uv * 0.5 + vec2(t * 0.01, t * 0.015)).rb - 0.5) * params.x;
    float a = texture(mainTexture, v_uv + vec2(t * 0.02, t * 0.01) + warp).g;
    float b = texture(mainTexture, v_uv * 1.37 + vec2(-t * 0.015, t * 0.02) - warp).g;
    float foam = smoothstep(0.62, 0.95, (a + b) * 0.5);
    vec3 col = mix(color2.rgb, color1.rgb, foam);
    return CCFragOutput(vec4(col, 1.0));
  }
}%
```

---

## 7. Các bước dựng lại từ đầu

1. Import `Building Map.glb` vào `assets/Shared/BuildingMap/`, cùng các texture ở mục 2.
2. Tạo 3 file effect ở mục 6 trong `effects/`, đợi editor import xong và kiểm tra Console không có lỗi shader.
3. Tạo các material ở mục 5. Material nào có giá trị khác mặc định thì nhập trong Inspector, hoặc thêm vào `_props[0]` của file `.mtl`, ví dụ `"lightStrength": 1`.
4. Trong Inspector của `Building Map.glb`, tab Materials: trỏ các sub-material sang file `.mtl` ngoài như mục 5. Hai material campfire thì gán trực tiếp trên MeshRenderer.
5. Kéo `Building Map` vào scene tại `(0,0,0)`.
6. Chỉnh Scene globals (mục 3), Main Light và Main Camera (mục 4).
7. Kiểm tra lại bằng mục 8.

---

## 8. Kiểm tra kết quả đúng

- Cát màu vàng cam ấm, **không** ngả kem nhạt hay xanh. Bề mặt matte, không có vệt bóng.
- Lá cọ và lily pad xanh lá đậm tự nhiên, **không** ra xanh nõn chuối và không bị cháy sáng (kênh G trên ảnh chụp không chạm 235–255 trên mảng lớn).
- Nước xanh ngọc, có vân bọt trôi.
- Nếu cát nhạt và lá trắng xám, tức là thiếu `lightStrength` hoặc `tintColor` (thường do material giữ giá trị cũ). Mở material và Reset các thông số về mặc định của effect.

---

## 9. Những chỗ dễ sai

- **Không chạy lại unity-material-importer đè lên các effect này.** Bản tự sinh hardcode `roughness 0.5 / specular 0.5`, không có phần màu cộng thẳng, và để tint ở giá trị gamma. Đó chính là nguyên nhân map bị bóng, tối và nhạt ban đầu.
- **Màu HDR của Unity:** muốn đổi Medium/Hard (Color ID khác), lấy màu chọn sRGB, đổi sang linear, rồi nhân `2^intensity`. Đừng `pow` cả giá trị HDR.
- **Đừng bật `Scene Ambient Weight`** nếu không định dùng ambient của scene Cocos; ambient này ngả xanh và làm cát bệch.
- **Đổi đèn scene ảnh hưởng tới map ít hơn bạn nghĩ:** hơn một nửa độ sáng đến từ emissive (Ambient Color + Light Strength). Muốn chỉnh sáng/tối thì chỉnh trên material.
- **Tone mapping** đang là ACES (mặc định). Bản Unity không có tone mapping. Nếu cần sát hơn nữa có thể đổi sang LINEAR (1), nhưng việc này ảnh hưởng cả nhân vật và VFX nên chưa áp dụng.
- **Scene view của editor** không vẽ lại khi đổi thuộc tính material bằng script. Khi so trước/sau, hãy reimport asset hoặc xoay camera một chút.

---

## 10. Nguồn tham chiếu bên Unity (DangerDungeon)

- Shader: `Assets/_DangerDungeon/Shaders/Lit_Environment_Advanced.shadergraph`, `Lit_Environment_Basic.shadergraph`, `Lit Basic With Shadow/*.shadersubgraph`.
- Material: `Assets/_DangerDungeon/Materials/M_Oasis_Dungeon_Easy.mat` (`_Light_Strength 0.7`, `_Smoothness 0`, `_Color_ID 1`, `_Easy (0.758, 1.498, 0.153)`, `_AlphaClipping 0.61`), `M_CampfireCooking.mat` (0.5), `M_CampfireCooking_Meal.mat` (1.0), `M_Dungeon_Color.mat` (0.15).
- Scene: `Assets/_DangerDungeon/Scene/Game_Building_Map.unity`: Directional Light intensity 0.8 màu trắng, ambient Flat `(0.449, 0.449, 0.449)`, không post-processing, project ở Linear color space.
