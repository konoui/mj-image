import { Parser } from "./parser";
import { drawBlocks, ImageHelperConfig } from "./image";
import { getFontContext } from "./context";
import { drawTable } from "./table";
import { TILE_CONTEXT } from "./constants";
import { SVG } from "@svgdotjs/svg.js";
// https://parceljs.org/languages/svg/#inlining-as-a-string
import tilesSvg from "./tiles.svg";

interface InitializeConfig extends Omit<ImageHelperConfig, "scale"> {
  querySelector?: string | string[];
  scale?: number;
  tableScale?: number;
}

const defaultQuerySelector = ".mjimage";
const defaultScale = 1.6;
const defaultSvgSprite = false;
const tableRegex = /^\s*table/;
const maxPaiHeight = Math.max(TILE_CONTEXT.WIDTH * 2, TILE_CONTEXT.HEIGHT);

const calculateScale = (scale: number, textHeight: number) => {
  return (textHeight / maxPaiHeight) * scale;
};

export class mjimage {
  static svgURL = () => {
    return tilesSvg;
  };

  static initialize = (props: InitializeConfig = {}) => {
    console.debug("initializing....");
    let querySelector = props.querySelector ?? defaultQuerySelector;
    let scale = props.scale ?? defaultScale;
    let tableScale = props.tableScale ?? scale;
    let svgSprite = props.svgSprite ?? defaultSvgSprite;
    if (typeof querySelector === "string") querySelector = [querySelector];

    querySelector.forEach((qs) => {
      console.debug("try to find", qs);
      const targets = document.querySelectorAll(qs) as NodeListOf<HTMLElement>;
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const input = target.textContent || "";

        if (input == "") {
          console.debug("skip due to not input");
          continue;
        }

        console.debug("found", input);
        target.textContent = ""; // remove first

        const font = target.style.font;
        const { textHeight } = getFontContext(font);

        const svg = SVG();

        try {
          if (tableRegex.test(input)) {
            drawTable(svg, input, {
              ...props,
              svgSprite,
              scale: calculateScale(tableScale, textHeight),
            });
          } else {
            const blocks = new Parser(input).parse();
            drawBlocks(svg, blocks, {
              ...props,
              svgSprite,
              scale: calculateScale(scale, textHeight),
            });
          }
          svg.addTo(target);
        } catch (e) {
          target.textContent = input;
          console.error("encounter unexpected error:", e);
        }
      }
    });
  };
}
