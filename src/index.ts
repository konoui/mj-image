import { Parser } from "./parser";
import { drawBlocks, ImageHelperConfig } from "./image";
import { getFontContext } from "./context";
import { drawTable } from "./table";
import { TILE_CONTEXT } from "./constants";
import { SVG } from "@svgdotjs/svg.js";

interface InitializeConfig extends Omit<ImageHelperConfig, "scale"> {
  querySelector?: string | string[];
  scale?: number;
  tableScale?: number;
}

const defaultQuerySelector = ".mjimage";
const defaultScale = 1.6;
const tableRegex = /^\s*table/;

export class mjimage {
  static initialize = (props: InitializeConfig = {}) => {
    console.debug("initializing....");
    let querySelector = props.querySelector ?? defaultQuerySelector;
    let scale = props.scale ?? defaultScale;
    let tableScale = props.tableScale ?? scale;
    if (typeof querySelector === "string") querySelector = [querySelector];

    const maxPaiHeight = Math.max(TILE_CONTEXT.WIDTH * 2, TILE_CONTEXT.HEIGHT);
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

        if (tableRegex.test(input)) {
          try {
            const calculatedTableScale =
              (textHeight / maxPaiHeight) * tableScale;
            console.debug(
              "input scale/calculated table scale",
              scale,
              calculatedTableScale
            );
            drawTable(svg, input, {
              ...props,
              scale: calculatedTableScale,
            });
            svg.addTo(target);
          } catch (e) {
            target.textContent = input;
            console.error(
              "encounter unexpected error when handling a table",
              e
            );
          }
          return;
        }

        try {
          const calculatedScale = (textHeight / maxPaiHeight) * scale;
          console.debug("input scale/calculated scale", scale, calculatedScale);
          const blocks = new Parser(input).parse();
          drawBlocks(svg, blocks, {
            ...props,
            scale: calculatedScale,
          });
          svg.addTo(target);
        } catch (e) {
          target.textContent = input;
          console.error("encounter unexpected error when handling a hand", e);
        }
      }
    });
  };
}
