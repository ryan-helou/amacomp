/**
 * What a built app gets instead of the avatar shop.
 *
 * next.config.ts points every production build at this file, so the shop's
 * code — the catalogue, its prices, the sprite sheet — is not merely unused in
 * the league's bundle but absent from it. Verified after each build by
 * grepping .next for an item name.
 */
export function AvatarLocker(): null {
  return null;
}
