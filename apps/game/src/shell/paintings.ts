/** A kit landscape at the width a surface needs, as an img src and srcset (public/images/landscapes/SOURCE.md). */
export const paintingSources = (painting: string) => ({
  src: `/images/landscapes/${painting}-800.webp`,
  srcSet: `/images/landscapes/${painting}-800.webp 800w, /images/landscapes/${painting}-1600.webp 1600w`,
});
