"use client";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface Props {
  open: boolean;
  src: string | null;
  alt: string;
  onClose: () => void;
}

export default function ProductLightbox({ open, src, alt, onClose }: Props) {
  if (!src) return null;

  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={[{ src, alt }]}
      carousel={{ finite: true }}
      render={{
        buttonPrev: () => null,
        buttonNext: () => null,
      }}
      styles={{
        container: { backgroundColor: "rgba(7, 18, 36, 0.92)" },
      }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
