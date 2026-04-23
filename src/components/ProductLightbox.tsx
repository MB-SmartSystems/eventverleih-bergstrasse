"use client";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface Slide {
  src: string;
  alt: string;
}

interface Props {
  open: boolean;
  slides: Slide[];
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export default function ProductLightbox({
  open,
  slides,
  index,
  onClose,
  onIndexChange,
}: Props) {
  if (!slides.length) return null;

  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={slides}
      index={index}
      on={{
        view: ({ index: i }) => onIndexChange?.(i),
      }}
      carousel={{ finite: slides.length <= 1 }}
      controller={{ closeOnBackdropClick: true }}
      styles={{
        container: { backgroundColor: "rgba(7, 18, 36, 0.92)" },
      }}
    />
  );
}
