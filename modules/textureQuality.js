// Phones crash on the full 4K textures (they decode to well over 1 GB of GPU memory),
// so touch devices load the 1024px copies kept in public/textures-mobile/ instead.
export const useMobileTextures = window.matchMedia("(pointer: coarse)").matches;

export const texturePath = (path) =>
  useMobileTextures ? `textures-mobile/${path}` : path;
