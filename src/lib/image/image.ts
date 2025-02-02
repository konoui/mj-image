import { Tile, Block, BlockAnKan, BlockHand } from "../core/parser";
import { Svg, G, Image, Text, Use, Symbol } from "@svgdotjs/svg.js";
import { FONT_FAMILY, TILE_CONTEXT, TYPE, OP, BLOCK } from "../core";
import { assert } from "../myassert";

export interface ImageHelperConfig {
  scale?: number;
  // specify either hostPath or hostUrl
  imageHostPath?: string;
  imageHostUrl?: string;
  imageExt?: "svg" | "webp";
  svgSprite?: boolean;
}

export interface DrawOptions {
  doraText?: boolean;
  tsumoText?: boolean;
}

const blockImageSize = (b: Block, scale: number) => {
  const size = tileImageSize(b.tiles[0], scale);
  const bh = size.baseHeight;
  const bw = size.baseWidth;
  if (b.is(BLOCK.SHO_KAN))
    return { width: bw * 2 + bh, height: Math.max(bw * 2, bh) };

  const maxHeight = b.tiles.reduce((max: number, t: Tile) => {
    const h = tileImageSize(t, scale).height;
    return h > max ? h : max;
  }, 0);
  const sumWidth = b.tiles.reduce((sum: number, t: Tile) => {
    return sum + tileImageSize(t, scale).width;
  }, 0);
  return { width: sumWidth, height: maxHeight };
};

const tileImageSize = (
  tile: Tile,
  scale: number
): {
  width: number;
  height: number;
  baseWidth: number;
  baseHeight: number;
} => {
  const h = parseFloat((TILE_CONTEXT.HEIGHT * scale).toPrecision(5));
  const w = parseFloat((TILE_CONTEXT.WIDTH * scale).toPrecision(5));
  const size = tile.has(OP.HORIZONTAL)
    ? { width: h, height: w, baseWidth: w, baseHeight: h }
    : { width: w, height: h, w, baseWidth: w, baseHeight: h };
  if (tile.has(OP.TSUMO) || tile.has(OP.DORA))
    size.width += w * TILE_CONTEXT.TEXT_SCALE; // note not contains text height
  return size;
};

class BaseHelper {
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly imageHostPath: string;
  readonly imageHostUrl: string;
  readonly imageExt: "svg" | "webp";
  readonly scale: number;
  readonly svgSprite: boolean;
  constructor(props: ImageHelperConfig = {}) {
    this.scale = props.scale ?? 1;
    this.imageHostPath = props.imageHostPath ?? "";
    this.imageHostUrl = props.imageHostUrl ?? "";
    this.imageExt = props.imageExt ?? "svg";
    this.tileWidth = TILE_CONTEXT.WIDTH * this.scale;
    this.tileHeight = TILE_CONTEXT.HEIGHT * this.scale;
    this.svgSprite = props.svgSprite ?? false;
  }

  protected getDiffTileHeightWidth(t: Tile) {
    const size = tileImageSize(t, this.scale);
    return (size.baseHeight - size.baseWidth) / 2;
  }

  // image wrapper
  private image(tile: Tile | 100 | 1000) {
    let img: Image | Use = new Image().load(this.buildURL(tile));
    if (this.svgSprite) {
      img = new Use().use(BaseHelper.buildID(tile));
    }

    if (tile instanceof Tile && tile.has(OP.COLOR_GRAYSCALE)) {
      img.css({ filter: "contrast(65%)" });
    }
    return img;
  }

  createImage(tile: Tile, x: number, y: number) {
    const size = tileImageSize(tile, this.scale);
    const image = this.image(tile)
      .dx(x)
      .dy(y)
      .size(size.baseWidth, size.baseHeight);
    return image;
  }

  createTextImage(tile: Tile, x: number, y: number, t: string) {
    const image = this.createImage(tile, x, y);

    const size = tileImageSize(tile, this.scale);
    const fontSize = size.baseHeight * 0.2;
    const textX = size.baseWidth;
    const textY = size.baseHeight;
    const text = new Text().text(t);
    text
      .size(size.baseWidth, size.baseHeight)
      .font({
        family: FONT_FAMILY,
        size: fontSize,
      })
      .dx(textX)
      .dy(textY);

    const g = new G();
    g.add(image).add(text).translate(x, y);
    return g;
  }

  createRotate90Image(
    tile: Tile,
    x: number,
    y: number,
    adjustY: boolean = false
  ) {
    const image = this.createImage(tile, 0, 0);

    const size = tileImageSize(tile, this.scale);
    const centerX = size.baseWidth / 2;
    const centerY = size.baseHeight / 2;
    const translatedX = x + this.getDiffTileHeightWidth(tile);
    const translatedY = adjustY ? y - this.getDiffTileHeightWidth(tile) : y;
    const g = new G();
    g.add(image)
      .translate(translatedX, translatedY)
      .rotate(90, centerX, centerY);
    return g;
  }

  createStick(v: 100 | 1000) {
    return this.image(v);
  }

  static buildID(tile: Tile | 100 | 1000) {
    if (tile == 100 || tile == 1000) {
      return tile == 100 ? "stick100" : "stick1000";
    }
    // original file is 0s/0m/0p
    const n = tile.t == TYPE.BACK || tile.has(OP.RED) ? 0 : tile.n;
    return `${tile.t}${n}`;
  }

  buildURL(tile: Tile | 100 | 1000) {
    const filename = `${BaseHelper.buildID(tile)}.${this.imageExt}`;
    if (this.imageHostUrl != "") {
      return `${this.imageHostUrl}${filename}`;
    }
    return `${this.imageHostPath}${filename}`;
  }
}

export class ImageHelper extends BaseHelper {
  readonly blockMargin =
    TILE_CONTEXT.WIDTH * TILE_CONTEXT.BLOCK_MARGIN_SCALE * this.scale;
  createBlockHandDiscard(block: Block) {
    const tiles =
      block instanceof BlockAnKan ? block.tilesWithBack : block.tiles;
    const g = new G();
    let pos = 0;
    for (const t of tiles) {
      const size = tileImageSize(t, this.scale);
      const f = t.has(OP.HORIZONTAL)
        ? this.createRotate90Image.bind(this)
        : this.createImage.bind(this);
      const y = t.has(OP.HORIZONTAL) ? this.getDiffTileHeightWidth(t) : 0;

      const img = f(t, pos, y);
      g.add(img);
      pos += size.width;
    }
    return g;
  }

  createBlockPonChiKan(block: Block) {
    const idx = block.tiles.findIndex((d) => d.has(OP.HORIZONTAL));

    let pos = 0;
    const g = new G();
    if (block.type == BLOCK.SHO_KAN) {
      let lastIdx = idx;
      for (let i = 0; i < block.tiles.length; i++)
        if (block.tiles[i].has(OP.HORIZONTAL)) lastIdx = i;

      for (let i = 0; i < block.tiles.length; i++) {
        const size = tileImageSize(block.tiles[i], this.scale);
        if (i == lastIdx) continue;
        if (i == idx) {
          const baseTile = block.tiles[idx];
          const upperTile = block.tiles[lastIdx];

          const size = tileImageSize(baseTile, this.scale);
          const baseImg = this.createRotate90Image(baseTile, 0, 0, true);
          const upImg = this.createRotate90Image(
            upperTile,
            0,
            size.height,
            true
          );
          g.add(new G().translate(pos, 0).add(baseImg).add(upImg));
          pos += size.width;
          continue;
        }

        const diff = size.width * 2 - size.height;
        const img = this.createImage(block.tiles[i], pos, diff);
        pos += size.width;
        g.add(img);
      }
      return g;
    }

    if (block.type == BLOCK.CHI) {
      const idxt = block.tiles[idx];
      const img = this.createRotate90Image(
        idxt,
        pos,
        this.getDiffTileHeightWidth(idxt)
      );
      pos += tileImageSize(idxt, this.scale).width;
      g.add(img);

      for (let i = 0; i < block.tiles.length; i++) {
        if (i == idx) continue;
        const t = block.tiles[i];
        const size = tileImageSize(t, this.scale);
        const img = this.createImage(t, pos, 0);
        pos += size.width;
        g.add(img);
      }
      return g;
    }

    for (let i = 0; i < block.tiles.length; i++) {
      const f =
        i == idx
          ? this.createRotate90Image.bind(this)
          : this.createImage.bind(this);
      const t = block.tiles[i];
      const y = i == idx ? this.getDiffTileHeightWidth(t) : 0;
      const size = tileImageSize(t, this.scale);
      const img = f(t, pos, y);
      pos += size.width;
      g.add(img);
    }
    return g;
  }
}

const getBlockCreators = (h: ImageHelper, options?: DrawOptions) => {
  const scale = h.scale;
  const lookup = {
    [BLOCK.CHI]: function (block: Block) {
      const size = blockImageSize(block, scale);
      const g = h.createBlockPonChiKan(block);
      return { ...size, e: g };
    },
    [BLOCK.PON]: function (block: Block) {
      const size = blockImageSize(block, scale);
      const g = h.createBlockPonChiKan(block);
      return { ...size, e: g };
    },
    [BLOCK.DAI_KAN]: function (block: Block) {
      const size = blockImageSize(block, scale);
      const g = h.createBlockPonChiKan(block);
      return { ...size, e: g };
    },
    [BLOCK.SHO_KAN]: function (block: Block) {
      const size = blockImageSize(block, scale);
      const g = h.createBlockPonChiKan(block);
      return { ...size, e: g };
    },
    [BLOCK.AN_KAN]: function (block: Block) {
      assert(
        block instanceof BlockAnKan,
        `block type is not ankan: ${block.type}`
      );
      const size = blockImageSize(block, scale);
      const g = h.createBlockHandDiscard(block);
      return { ...size, e: g };
    },
    [BLOCK.IMAGE_DORA]: function (block: Block) {
      block =
        options?.doraText == false
          ? new BlockHand([block.tiles[0].clone({ remove: OP.DORA })])
          : block;
      const size = blockImageSize(block, scale);
      const g = new G();
      const img =
        options?.doraText === false
          ? h.createImage(block.tiles[0], 0, 0)
          : h.createTextImage(block.tiles[0], 0, 0, "(ドラ)");
      g.add(img);
      return { ...size, e: g };
    },
    [BLOCK.TSUMO]: function (block: Block) {
      block =
        options?.tsumoText == false
          ? new BlockHand([block.tiles[0].clone({ remove: OP.TSUMO })])
          : block;
      const size = blockImageSize(block, scale);
      const g = new G();
      const img =
        options?.tsumoText === false
          ? h.createImage(block.tiles[0], 0, 0)
          : h.createTextImage(block.tiles[0], 0, 0, "(ツモ)");
      g.add(img);
      return { ...size, e: g };
    },
    [BLOCK.HAND]: function (block: Block) {
      const size = blockImageSize(block, scale);
      const g = h.createBlockHandDiscard(block);
      return { ...size, e: g };
    },
    [BLOCK.IMAGE_DISCARD]: function (block: Block) {
      const size = blockImageSize(block, scale);
      const g = h.createBlockHandDiscard(block);
      return { ...size, e: g };
    },
    [BLOCK.THREE]: function (block: Block) {
      throw new Error("three is unsupported");
    },
    [BLOCK.RUN]: function (block: Block) {
      throw new Error("run is unsupported");
    },
    [BLOCK.PAIR]: function (block: Block) {
      throw new Error("pair is unsupported");
    },
    [BLOCK.ISOLATED]: function (block: Block) {
      throw new Error("isolated is unsupported");
    },
    [BLOCK.UNKNOWN]: function (block: Block) {
      // unable to draw tsumo/dora
      if (block.tiles.some((t) => t.has(OP.TSUMO) || t.has(OP.DORA)))
        throw new Error("found an unknown block with operator tiles");
      const size = blockImageSize(block, scale);
      const g = h.createBlockHandDiscard(block);
      return { ...size, e: g };
    },
  };

  return lookup;
};

interface MySVGElement {
  e: G;
  width: number;
  height: number;
}

export const createHand = (
  helper: ImageHelper,
  blocks: Block[],
  options?: DrawOptions
) => {
  const creators = getBlockCreators(helper, options);

  let maxHeight = 0;
  let sumWidth = 0;
  const elms: MySVGElement[] = [];
  for (const block of blocks) {
    const fn = creators[block.type];
    const elm = fn(block);
    sumWidth += elm.width;
    maxHeight = elm.height > maxHeight ? elm.height : maxHeight;
    elms.push(elm);
  }

  const viewBoxHeight = maxHeight;
  const viewBoxWidth = sumWidth + (blocks.length - 1) * helper.blockMargin;

  const hand = new G();
  let pos = 0;
  for (const elm of elms) {
    const diff = viewBoxHeight - elm.height;
    const g = new G().translate(pos, diff);
    g.add(elm.e);
    hand.add(g);
    pos += elm.width + helper.blockMargin;
  }
  return { e: hand, width: viewBoxWidth, height: viewBoxHeight };
};

export const drawBlocks = (
  svg: Svg,
  blocks: Block[],
  config: ImageHelperConfig = {},
  options: { responsive?: boolean } & DrawOptions = {
    responsive: false,
    doraText: true,
    tsumoText: true,
  }
) => {
  const helper = new ImageHelper(config);
  const hand = createHand(helper, blocks, options);
  if (!options.responsive) svg.size(hand.width, hand.height);
  svg.viewbox(0, 0, hand.width, hand.height);
  svg.add(hand.e);
};

const getValidIDs = () => {
  const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ids: string[] = [];
  for (const kind of Object.values(TYPE)) {
    if (kind == TYPE.BACK) {
      ids.push(BaseHelper.buildID(new Tile(kind, 0)));
      continue;
    }

    ids.push(
      ...values.map((v) => BaseHelper.buildID(new Tile(kind, v))).flat()
    );
  }
  return ids;
};

const findUsedIDs = (draw: Svg) => {
  const validIDs = getValidIDs();
  const usedIDs: string[] = [];
  draw.each((idx, children) => {
    const node = children[idx];
    if (node instanceof Use) {
      // https://github.com/svgdotjs/svg.js/blob/3.2.0/src/elements/Use.js#L14
      const hrefAttr: string = node.attr("href");
      const id = hrefAttr.substring(1);
      if (validIDs.includes(id)) usedIDs.push(id);
    }
  });
  return usedIDs;
};

export const optimizeSVG = (draw: Svg) => {
  const validIDs = getValidIDs();
  const usedIDs = findUsedIDs(draw);
  draw.each((idx, children) => {
    const node = children[idx];
    if (node instanceof Symbol) {
      const isUsed =
        validIDs.includes(node.id()) && usedIDs.includes(node.id());
      if (!isUsed) node.remove();
    }
  }, true);
};
