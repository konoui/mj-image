import { OP, Tile, Type } from "../core";
import { assert } from "../myassert";
import { Hand, ShantenCalculator, forHand } from "./calc";

export interface SerializedCandidate {
  tile: string;
  candidates: readonly string[];
  shanten: number;
}

// Controller tell candidates to players
export interface Candidate {
  tile: Tile;
  candidates: readonly Tile[];
  // next shanten if draw a candidate
  shanten: number;
}

export class Efficiency {
  // ツモった後の14枚の手配から、牌効率に従って捨てるべき牌を返す。
  // choices は、通常なら hand.hand を指定する。ただし、リーチしている場合は捨てる牌が限られているので choices で制限する。
  static calcCandidates(
    hand: Hand,
    choices: Tile[],
    options?: {
      arrangeRed?: boolean;
      fourSetsOnePair?: boolean;
    }
  ): Candidate[] {
    assert(choices.length > 0, `choices to discard is zero`);
    const map = new Map<string, Candidate>();
    let minShanten = Infinity;
    for (const t of choices) {
      const tiles = hand.dec([t]);
      const c = Efficiency.candidateTiles(hand, options);
      hand.inc(tiles);
      // convert 0 and remove operators
      const da =
        options?.arrangeRed && t.has(OP.RED)
          ? t.clone({ removeAll: true })
          : t.has(OP.RED)
          ? t.clone({ removeAll: true, add: OP.RED })
          : t.clone({ removeAll: true });
      if (c.shanten < minShanten) {
        map.clear();
        map.set(da.toString(), {
          shanten: c.shanten,
          candidates: c.candidates,
          tile: da,
        });
        // update
        minShanten = c.shanten;
      } else if (c.shanten == minShanten) {
        map.set(da.toString(), {
          shanten: c.shanten,
          candidates: c.candidates,
          tile: da,
        });
      }
    }
    return Array.from(map.values());
  }

  // 積もる前の13枚の手配から、有効牌の一覧を返す
  static candidateTiles(
    hand: Hand,
    options?: {
      fourSetsOnePair?: boolean;
      typeFilter?: Type[];
    }
  ) {
    let r = Infinity;
    let candidates: Tile[] = [];

    const sc = new ShantenCalculator(hand);
    for (const [t, n] of forHand({
      skipBack: true,
      filterBy: options?.typeFilter,
    })) {
      if (hand.get(t, n) >= 4) continue;
      const tile = new Tile(t, n);
      const tiles = hand.inc([tile]);
      const s = !options?.fourSetsOnePair ? sc.calc() : sc.fourSetsOnePair();
      hand.dec(tiles);

      if (s < r) {
        r = s;
        candidates = [tile];
      } else if (s == r) candidates.push(tile);
    }
    return {
      shanten: r,
      candidates: candidates,
    };
  }
}
