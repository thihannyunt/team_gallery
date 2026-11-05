#!/bin/bash
# Makes the GPU-compressed .ktx2 copy beside each texture's .jpg (modules/textureQuality.js loads them).
# Needs basisu: brew install basis_universal. Run it again after changing or adding a texture or photo.
# Usage, from the project folder: scripts/make-ktx2.sh
# Colour textures and photos: ETC1S (sRGB); roughness: ETC1S, linear; normal maps: UASTC (ETC1S blurs their
# bumps). -y_flip matches the JPEGs' upright UVs.
set -e
cd "$(dirname "$0")/../public"
W=$(mktemp -d)
encode() { # src kind [size]: with a size, the image is squeezed to that square (photos; see below)
  local src=$1 kind=$2 out=${1%.jpg}.ktx2
  local w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}') h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
  local w4=${3:-$w} h4=${3:-$h}
  local png="$W/$(echo "$src" | tr '/' '_').png"
  sips -s format png -z $h4 $w4 "$src" --out "$png" >/dev/null
  case $kind in
    color) flags="-etc1s -quality 95 -effort 6" ;;
    linear) flags="-etc1s -quality 95 -effort 6 -linear" ;;
    normal) flags="-uastc -uastc_level 2 -uastc_rdo_l 1.0 -normal_map" ;;
  esac
  basisu -ktx2 $flags -mipmap -y_flip -output_file "$out" "$png" > "$W/log.txt" 2>&1 || { echo "FAILED $src"; tail -3 "$W/log.txt"; return 0; }
  echo "$(du -h "$src" | cut -f1) -> $(du -h "$out" | cut -f1)  ${w}x${h}->${w4}x${h4}  $out"
}
for set in textures-2k textures-mobile; do
  encode $set/WoodFloor040_4K-JPG/WoodFloor040_4K_Color.jpg color
  encode $set/WoodFloor040_4K-JPG/WoodFloor040_4K_Roughness.jpg linear
  encode $set/OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_Color.jpg color
  encode $set/leather_white_4k.gltf/textures/leather_white_rough_4k.jpg linear
done
# Normal maps: the 1024px copies serve every device
encode textures-mobile/WoodFloor040_4K-JPG/WoodFloor040_4K_NormalGL.jpg normal
encode textures-mobile/OfficeCeiling005_4K-JPG/OfficeCeiling005_4K_NormalGL.jpg normal
encode textures-mobile/leather_white_4k.gltf/textures/leather_white_nor_gl_4k.jpg normal
# Photos are squeezed into a power-of-two square: every smaller mip level of a compressed texture must
# still divide into the GPU's 4x4 blocks, which a 1638 px wide photo stops doing a few levels down (it
# showed black). The frame's photo plane keeps the real shape, so it's stretched back on the wall.
for name in four_people cooperate_team_portrait abp abp_eye ar_kar arkar ko_pyae myat pyae_sone thn; do
  encode artworks/mine/$name.jpg color 2048
  encode textures-mobile/artworks/mine/$name.jpg color 1024
done
rm -rf "$W"
